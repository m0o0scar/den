#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { withServerActionsEncryptionKey } from "../src/lib/server-actions-key.mjs";
import { resolveStartupPort } from "../src/lib/startup-port.mjs";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const nextBin = require.resolve("next/dist/bin/next");

function parseExplicitPort(nextArgs) {
  let port = undefined;
  let portExplicit = false;
  const argsWithoutPort = [];

  for (let index = 0; index < nextArgs.length; index += 1) {
    const arg = nextArgs[index];
    if (arg !== "--port" && arg !== "-p") {
      argsWithoutPort.push(arg);
      continue;
    }

    const value = nextArgs[index + 1];
    if (!value) {
      throw new Error("Missing value for --port.");
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      throw new Error(`Invalid port: ${value}`);
    }

    port = parsed;
    portExplicit = true;
    index += 1;
  }

  return { argsWithoutPort, port, portExplicit };
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function hasActiveDevLock(devDir, { fsImpl = fs, isProcessRunningImpl = isProcessRunning } = {}) {
  try {
    const lockPath = path.join(devDir, "lock");
    if (!fsImpl.existsSync(lockPath)) {
      return false;
    }

    const lock = JSON.parse(fsImpl.readFileSync(lockPath, "utf8"));
    return isProcessRunningImpl(lock.pid);
  } catch {
    return false;
  }
}

function findFirstInvalidJsonFile(rootDir, { fsImpl = fs } = {}) {
  if (!fsImpl.existsSync(rootDir)) {
    return null;
  }

  const pending = [rootDir];
  while (pending.length > 0) {
    const currentDir = pending.pop();
    const entries = fsImpl.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      try {
        JSON.parse(fsImpl.readFileSync(fullPath, "utf8"));
      } catch {
        return fullPath;
      }
    }
  }

  return null;
}

function findFirstSyntheticMissingModuleStub(rootDir, { fsImpl = fs } = {}) {
  if (!fsImpl.existsSync(rootDir)) {
    return null;
  }

  const pending = [rootDir];
  while (pending.length > 0) {
    const currentDir = pending.pop();
    const entries = fsImpl.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".js")) {
        continue;
      }

      let content;
      try {
        content = fsImpl.readFileSync(fullPath, "utf8");
      } catch {
        continue;
      }

      if (
        content.includes("Could not parse module")
        && content.includes("file not found")
        && content.includes("MODULE_UNPARSABLE")
      ) {
        return fullPath;
      }
    }
  }

  return null;
}

export function repairCorruptedDevArtifacts(
  appRoot = APP_ROOT,
  { fsImpl = fs, isProcessRunningImpl = isProcessRunning } = {},
) {
  const devDir = path.join(appRoot, ".next", "dev");

  if (!fsImpl.existsSync(devDir)) {
    return { cleaned: false, reason: "missing" };
  }

  if (hasActiveDevLock(devDir, { fsImpl, isProcessRunningImpl })) {
    return { cleaned: false, reason: "active-lock" };
  }

  const invalidFile = findFirstInvalidJsonFile(devDir, { fsImpl });
  if (invalidFile) {
    fsImpl.rmSync(devDir, { recursive: true, force: true });
    return { cleaned: true, reason: "corrupt-json", invalidFile };
  }

  const stubFile = findFirstSyntheticMissingModuleStub(devDir, { fsImpl });
  if (stubFile) {
    fsImpl.rmSync(devDir, { recursive: true, force: true });
    return { cleaned: true, reason: "missing-module-stub", invalidFile: stubFile };
  }

  return { cleaned: false, reason: "healthy" };
}

export async function resolveNextArgs(
  argv = process.argv.slice(2),
  env = process.env,
  { resolveStartupPortImpl = resolveStartupPort } = {},
) {
  if (argv.length === 0) {
    return { nextArgs: [] };
  }

  const [command, ...rest] = argv;
  if (command !== "dev" && command !== "start") {
    return { nextArgs: [...argv] };
  }

  const { argsWithoutPort, port, portExplicit } = parseExplicitPort(rest);
  const resolved = await resolveStartupPortImpl({ port, portExplicit, env });

  return {
    ...resolved,
    nextArgs: [command, ...argsWithoutPort, "--port", String(resolved.port)],
  };
}

export async function run(argv = process.argv.slice(2), { env = process.env, spawnImpl = spawn } = {}) {
  if (argv[0] === "dev") {
    const repairResult = repairCorruptedDevArtifacts(APP_ROOT);
    if (repairResult.cleaned) {
      const invalidPath = path.relative(APP_ROOT, repairResult.invalidFile);
      console.warn(
        `Detected corrupted Turbopack dev state in ${invalidPath}. Removed .next/dev before starting Next.js.`,
      );
    }
  }

  const { nextArgs, port, preferredPort } = await resolveNextArgs(argv, env);
  if (typeof port === "number" && port !== preferredPort) {
    console.log(`Port ${preferredPort} is in use. Using ${port} instead.`);
  }

  const child = spawnImpl(process.execPath, [nextBin, ...nextArgs], {
    cwd: APP_ROOT,
    env: withServerActionsEncryptionKey(env, { appRoot: APP_ROOT }),
    stdio: "inherit",
  });

  child.on("error", (error) => {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Failed to launch Next.js: ${detail}`);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    const invokedPath = fs.realpathSync(path.resolve(process.argv[1]));
    const modulePath = fs.realpathSync(fileURLToPath(import.meta.url));
    return invokedPath === modulePath;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  void run();
}
