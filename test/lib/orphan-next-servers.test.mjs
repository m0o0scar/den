import { describe, it } from "node:test";
import assert from "node:assert";
import {
  DEFAULT_ORPHAN_NEXT_SERVER_CLEANUP_INTERVAL_MS,
  identifyOrphanNextServerProcesses,
  parseProcessTable,
  startOrphanNextServerCleanupLoop,
} from "../../src/lib/orphan-next-servers.mjs";

describe("parseProcessTable", () => {
  it("parses pid, ppid, and command columns", () => {
    assert.deepStrictEqual(
      parseProcessTable("123 1 next-server (v16.2.1)\n456 123 node ./bin/viba.mjs\n"),
      [
        { pid: 123, ppid: 1, command: "next-server (v16.2.1)" },
        { pid: 456, ppid: 123, command: "node ./bin/viba.mjs" },
      ],
    );
  });
});

describe("identifyOrphanNextServerProcesses", () => {
  it("keeps only orphaned next-server processes for the current repo and unprotected ports", () => {
    const processes = [
      { pid: 10, ppid: 1, command: "next-server (v16.2.1)" },
      { pid: 11, ppid: 22, command: "next-server (v16.2.1)" },
      { pid: 12, ppid: 1, command: "node ./bin/viba.mjs" },
      { pid: 13, ppid: 1, command: "next-server (v16.2.1)" },
      { pid: 14, ppid: 1, command: "next-server (v16.2.1)" },
    ];
    const cwdByPid = new Map([
      [10, "/repo"],
      [11, "/repo"],
      [13, "/other"],
      [14, "/repo"],
    ]);
    const portsByPid = new Map([
      [10, [3201]],
      [11, [3202]],
      [13, [3203]],
      [14, [3200]],
    ]);

    assert.deepStrictEqual(
      identifyOrphanNextServerProcesses(processes, {
        appRoot: "/repo",
        cwdByPid,
        portsByPid,
        protectPorts: [3200],
      }),
      [{ pid: 10, ppid: 1, command: "next-server (v16.2.1)", cwd: "/repo", ports: [3201] }],
    );
  });
});

describe("startOrphanNextServerCleanupLoop", () => {
  it("runs cleanup immediately and on the configured interval", async () => {
    const cleanupCalls = [];
    const logged = [];
    const cleared = [];
    let intervalCallback = null;
    const timer = { unref() {} };

    const loop = startOrphanNextServerCleanupLoop(
      {
        appRoot: "/repo",
        protectPorts: [3200, 3203],
        logger: {
          log(message) {
            logged.push(message);
          },
          warn(message) {
            logged.push(`warn:${message}`);
          },
        },
      },
      {
        cleanupImpl: async ({ appRoot, protectPorts }) => {
          cleanupCalls.push({ appRoot, protectPorts });
          return cleanupCalls.length === 1
            ? [{ pid: 99, ports: [3201], signal: "SIGTERM" }]
            : [];
        },
        setIntervalImpl: (callback, intervalMs) => {
          assert.strictEqual(intervalMs, DEFAULT_ORPHAN_NEXT_SERVER_CLEANUP_INTERVAL_MS);
          intervalCallback = callback;
          return timer;
        },
        clearIntervalImpl: (value) => {
          cleared.push(value);
        },
      },
    );

    await loop.runNow();
    assert.deepStrictEqual(cleanupCalls, [{ appRoot: "/repo", protectPorts: [3200, 3203] }]);
    assert.deepStrictEqual(logged, ["Stopped orphaned next-server PID 99 on 3201 via SIGTERM."]);

    await intervalCallback();
    assert.deepStrictEqual(cleanupCalls, [
      { appRoot: "/repo", protectPorts: [3200, 3203] },
      { appRoot: "/repo", protectPorts: [3200, 3203] },
    ]);

    loop.stop();
    assert.deepStrictEqual(cleared, [timer]);
  });
});
