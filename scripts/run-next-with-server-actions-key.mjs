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
