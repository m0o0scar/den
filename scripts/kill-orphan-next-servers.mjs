#!/usr/bin/env node

import { cleanupOrphanNextServers } from "../src/lib/orphan-next-servers.mjs";

const APP_ROOT = process.cwd();
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const protectPorts = new Set([3200]);

for (let index = 0; index < args.length; index += 1) {
  const value = args[index];
  if (value === "--protect-port") {
    const nextValue = args[index + 1];
    const parsedPort = Number.parseInt(nextValue ?? "", 10);
    if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      console.error(`Invalid port passed to --protect-port: ${nextValue ?? ""}`);
      process.exit(1);
    }
    protectPorts.add(parsedPort);
    index += 1;
  }
}

async function main() {
  const results = await cleanupOrphanNextServers({
    appRoot: APP_ROOT,
    protectPorts: [...protectPorts],
    dryRun,
  });

  if (results.length === 0) {
    console.log(`No orphaned next-server processes found for ${APP_ROOT}`);
    return;
  }

  for (const result of results) {
    const portLabel = result.ports.length > 0 ? result.ports.join(", ") : "no listening ports";
    if (result.action === "would-stop") {
      console.log(`Would stop PID ${result.pid} on ${portLabel}: ${result.command}`);
      continue;
    }
    console.log(`Stopped PID ${result.pid} on ${portLabel} via ${result.signal}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
