import { spawnSync } from "node:child_process";
import path from "node:path";

export const DEFAULT_ORPHAN_NEXT_SERVER_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

function normalizeRepoRoot(value) {
  return path.resolve(value).replace(/\/+$/, "");
}

function getPlatformCommand(command, platform = process.platform) {
  if (platform === "darwin") {
    if (command === "ps") {
      return "/bin/ps";
    }
    if (command === "lsof") {
      return "/usr/sbin/lsof";
    }
  }
  return command;
}

function runTextCommand(command, args, { spawnSyncImpl = spawnSync, cwd, env, platform = process.platform } = {}) {
  return spawnSyncImpl(getPlatformCommand(command, platform), args, {
    cwd,
    env,
    encoding: "utf8",
  });
}

export function parseProcessTable(stdout) {
  return (stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.*)$/);
      if (!match) {
        return null;
      }

      return {
        pid: Number.parseInt(match[1], 10),
        ppid: Number.parseInt(match[2], 10),
        command: match[3],
      };
    })
    .filter(Boolean);
}

export function identifyOrphanNextServerProcesses(
  processEntries,
  { appRoot, cwdByPid = new Map(), portsByPid = new Map(), protectPorts = [] },
) {
  const normalizedAppRoot = normalizeRepoRoot(appRoot);
  const protectedPorts = new Set(protectPorts);

  return processEntries
    .filter((entry) => entry.ppid === 1)
    .filter((entry) => entry.command.includes("next-server"))
    .map((entry) => ({
      ...entry,
      cwd: cwdByPid.get(entry.pid) ?? null,
      ports: portsByPid.get(entry.pid) ?? [],
    }))
    .filter((entry) => entry.cwd === normalizedAppRoot)
    .filter((entry) => entry.ports.every((port) => !protectedPorts.has(port)));
}

function getNextServerProcesses({ appRoot, env, spawnSyncImpl, platform }) {
  const result = runTextCommand("ps", ["-Ao", "pid=,ppid=,command="], {
    cwd: appRoot,
    env,
    spawnSyncImpl,
    platform,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr ?? result.stdout ?? "Failed to inspect running processes").trim());
  }

  return parseProcessTable(result.stdout);
}

function getProcessCwd(pid, { appRoot, env, spawnSyncImpl, platform }) {
  const result = runTextCommand("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
    cwd: appRoot,
    env,
    spawnSyncImpl,
    platform,
  });
  if (result.status !== 0) {
    return null;
  }

  for (const line of (result.stdout ?? "").split("\n")) {
    if (line.startsWith("n")) {
      return normalizeRepoRoot(line.slice(1));
    }
  }

  return null;
}

function getListeningPorts(pid, { appRoot, env, spawnSyncImpl, platform }) {
  const result = runTextCommand(
    "lsof",
    ["-nP", "-a", "-p", String(pid), "-iTCP", "-sTCP:LISTEN", "-Fn"],
    {
      cwd: appRoot,
      env,
      spawnSyncImpl,
      platform,
    },
  );
  if (result.status !== 0) {
    return [];
  }

  return Array.from(
    new Set(
      (result.stdout ?? "")
        .split("\n")
        .filter((line) => line.startsWith("n"))
        .map((line) => {
          const match = line.match(/:(\d+)(?:\s|\(|$)/);
          return match ? Number.parseInt(match[1], 10) : null;
        })
        .filter((value) => Number.isInteger(value)),
    ),
  );
}

function isRunning(pid, killImpl = process.kill.bind(process)) {
  try {
    killImpl(pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

async function terminatePid(
  pid,
  {
    killImpl = process.kill.bind(process),
    sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  killImpl(pid, "SIGTERM");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isRunning(pid, killImpl)) {
      return "SIGTERM";
    }
    await sleepImpl(250);
  }

  killImpl(pid, "SIGKILL");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!isRunning(pid, killImpl)) {
      return "SIGKILL";
    }
    await sleepImpl(250);
  }

  throw new Error(`Process ${pid} did not exit after SIGKILL`);
}

export async function cleanupOrphanNextServers(
  { appRoot, protectPorts = [], dryRun = false },
  {
    env = process.env,
    spawnSyncImpl = spawnSync,
    killImpl = process.kill.bind(process),
    sleepImpl,
    platform = process.platform,
  } = {},
) {
  if (platform === "win32") {
    return [];
  }

  const processEntries = getNextServerProcesses({ appRoot, env, spawnSyncImpl, platform });
  const cwdByPid = new Map();
  const portsByPid = new Map();

  for (const entry of processEntries) {
    if (!entry.command.includes("next-server")) {
      continue;
    }
    cwdByPid.set(entry.pid, getProcessCwd(entry.pid, { appRoot, env, spawnSyncImpl, platform }));
    portsByPid.set(entry.pid, getListeningPorts(entry.pid, { appRoot, env, spawnSyncImpl, platform }));
  }

  const orphanedProcesses = identifyOrphanNextServerProcesses(processEntries, {
    appRoot,
    cwdByPid,
    portsByPid,
    protectPorts,
  });

  const results = [];
  for (const processInfo of orphanedProcesses) {
    if (dryRun) {
      results.push({ ...processInfo, signal: null, action: "would-stop" });
      continue;
    }

    const signal = await terminatePid(processInfo.pid, { killImpl, sleepImpl });
    results.push({ ...processInfo, signal, action: "stopped" });
  }

  return results;
}

export function startOrphanNextServerCleanupLoop(
  { appRoot, protectPorts = [], intervalMs = DEFAULT_ORPHAN_NEXT_SERVER_CLEANUP_INTERVAL_MS, logger = console },
  {
    cleanupImpl = cleanupOrphanNextServers,
    setIntervalImpl = setInterval,
    clearIntervalImpl = clearInterval,
  } = {},
) {
  let timer = null;
  let activeRun = null;
  let stopped = false;

  const runCleanup = async () => {
    if (stopped || activeRun) {
      return activeRun ?? [];
    }

    activeRun = (async () => {
      const results = await cleanupImpl({ appRoot, protectPorts });
      for (const result of results) {
        const portLabel = result.ports.length > 0 ? result.ports.join(", ") : "no listening ports";
        logger.log(`Stopped orphaned next-server PID ${result.pid} on ${portLabel} via ${result.signal}.`);
      }
      return results;
    })()
      .catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        logger.warn?.(`Failed to clean orphaned next-server processes: ${detail}`);
        return [];
      })
      .finally(() => {
        activeRun = null;
      });

    return activeRun;
  };

  void runCleanup();
  timer = setIntervalImpl(() => {
    void runCleanup();
  }, intervalMs);
  timer?.unref?.();

  return {
    stop() {
      stopped = true;
      if (timer) {
        clearIntervalImpl(timer);
        timer = null;
      }
    },
    runNow: runCleanup,
  };
}
