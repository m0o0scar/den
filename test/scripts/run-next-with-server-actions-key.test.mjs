import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  repairCorruptedDevArtifacts,
  resolveNextArgs,
} from "../../scripts/run-next-with-server-actions-key.mjs";

test("resolveNextArgs allocates the next available port for dev when none is explicit", async () => {
  let received = null;

  const result = await resolveNextArgs(
    ["dev"],
    {},
    {
      resolveStartupPortImpl: async (options) => {
        received = options;
        return { preferredPort: 3200, port: 3204 };
      },
    },
  );

  assert.deepEqual(received, { env: {}, port: undefined, portExplicit: false });
  assert.deepEqual(result, {
    preferredPort: 3200,
    port: 3204,
    nextArgs: ["dev", "--port", "3204"],
  });
});

test("resolveNextArgs preserves an explicit port for dev", async () => {
  let received = null;

  const result = await resolveNextArgs(
    ["dev", "--hostname", "127.0.0.1", "--port", "3300"],
    {},
    {
      resolveStartupPortImpl: async (options) => {
        received = options;
        return { preferredPort: 3300, port: 3300 };
      },
    },
  );

  assert.deepEqual(received, { env: {}, port: 3300, portExplicit: true });
  assert.deepEqual(result, {
    preferredPort: 3300,
    port: 3300,
    nextArgs: ["dev", "--hostname", "127.0.0.1", "--port", "3300"],
  });
});

test("resolveNextArgs leaves non-server commands unchanged", async () => {
  const result = await resolveNextArgs(["build", "--webpack"], {});
  assert.deepEqual(result, {
    nextArgs: ["build", "--webpack"],
  });
});

test("repairCorruptedDevArtifacts removes a corrupted .next/dev directory when no server lock is active", () => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "den-dev-cache-"));
  const devDir = path.join(appRoot, ".next", "dev");
  const badFile = path.join(devDir, "server", "pages", "_app", "build-manifest.json");

  try {
    fs.mkdirSync(path.dirname(badFile), { recursive: true });
    fs.writeFileSync(badFile, '{"pages": [', "utf8");

    const result = repairCorruptedDevArtifacts(appRoot, {
      isProcessRunningImpl: () => false,
    });

    assert.deepEqual(result, {
      cleaned: true,
      reason: "corrupt-json",
      invalidFile: badFile,
    });
    assert.equal(fs.existsSync(devDir), false);
  } finally {
    fs.rmSync(appRoot, { recursive: true, force: true });
  }
});

test("repairCorruptedDevArtifacts preserves .next/dev when a live lock is present", () => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "den-dev-cache-lock-"));
  const devDir = path.join(appRoot, ".next", "dev");
  const badFile = path.join(devDir, "server", "pages", "_app", "build-manifest.json");
  const lockFile = path.join(devDir, "lock");

  try {
    fs.mkdirSync(path.dirname(badFile), { recursive: true });
    fs.writeFileSync(badFile, '{"pages": [', "utf8");
    fs.writeFileSync(lockFile, JSON.stringify({ pid: 12345 }), "utf8");

    const result = repairCorruptedDevArtifacts(appRoot, {
      isProcessRunningImpl: (pid) => pid === 12345,
    });

    assert.deepEqual(result, {
      cleaned: false,
      reason: "active-lock",
    });
    assert.equal(fs.existsSync(devDir), true);
  } finally {
    fs.rmSync(appRoot, { recursive: true, force: true });
  }
});

test("repairCorruptedDevArtifacts leaves a healthy .next/dev directory intact", () => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "den-dev-cache-healthy-"));
  const devDir = path.join(appRoot, ".next", "dev");
  const manifestFile = path.join(devDir, "server", "pages", "_app", "build-manifest.json");

  try {
    fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
    fs.writeFileSync(manifestFile, '{"pages":{"/_app":[]}}', "utf8");

    const result = repairCorruptedDevArtifacts(appRoot, {
      isProcessRunningImpl: () => false,
    });

    assert.deepEqual(result, {
      cleaned: false,
      reason: "healthy",
    });
    assert.equal(fs.existsSync(devDir), true);
  } finally {
    fs.rmSync(appRoot, { recursive: true, force: true });
  }
});

test("repairCorruptedDevArtifacts removes a dev graph with Turbopack synthetic missing-module stubs", () => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "den-dev-cache-stub-"));
  const devDir = path.join(appRoot, ".next", "dev");
  const stubFile = path.join(devDir, "server", "chunks", "ssr", "broken.js");

  try {
    fs.mkdirSync(path.dirname(stubFile), { recursive: true });
    fs.writeFileSync(
      stubFile,
      [
        "const e = new Error(\"Could not parse module '[project]/node_modules/next/app.js', file not found\");",
        "e.code = 'MODULE_UNPARSABLE';",
        "throw e;",
      ].join("\n"),
      "utf8",
    );

    const result = repairCorruptedDevArtifacts(appRoot, {
      isProcessRunningImpl: () => false,
    });

    assert.deepEqual(result, {
      cleaned: true,
      reason: "missing-module-stub",
      invalidFile: stubFile,
    });
    assert.equal(fs.existsSync(devDir), false);
  } finally {
    fs.rmSync(appRoot, { recursive: true, force: true });
  }
});
