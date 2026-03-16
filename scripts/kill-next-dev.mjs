#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const APP_ROOT = process.cwd();
const lockPath = path.join(APP_ROOT, '.next', 'dev', 'lock');

function run(command, args) {
  return spawnSync(command, args, {
    cwd: APP_ROOT,
    env: process.env,
    encoding: 'utf8',
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHolderPids(targetPath) {
  const result = run('/usr/sbin/lsof', ['-t', '--', targetPath]);
  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (!output) {
      return [];
    }
    throw new Error(output);
  }

  return Array.from(new Set(
    (result.stdout ?? '')
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0)
  ));
}

function getProcessLabel(pid) {
  const result = run('/bin/ps', ['-p', String(pid), '-o', 'command=']);
  if (result.status !== 0) {
    return `pid ${pid}`;
  }

  return (result.stdout ?? '').trim() || `pid ${pid}`;
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined;
    if (code === 'ESRCH') {
      return false;
    }
    throw error;
  }
}

async function terminatePid(pid) {
  process.kill(pid, 'SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isRunning(pid)) {
      return 'SIGTERM';
    }
    await sleep(250);
  }

  process.kill(pid, 'SIGKILL');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!isRunning(pid)) {
      return 'SIGKILL';
    }
    await sleep(250);
  }

  throw new Error(`Process ${pid} did not exit after SIGKILL`);
}

async function main() {
  if (!fs.existsSync(lockPath)) {
    console.log(`No Next.js dev lock found at ${lockPath}`);
    return;
  }

  const pids = getHolderPids(lockPath);
  if (pids.length === 0) {
    console.log(`No running process is holding ${lockPath}`);
    console.log('The lock file may be stale. Remove it manually if restarting still fails.');
    return;
  }

  for (const pid of pids) {
    const label = getProcessLabel(pid);
    const signal = await terminatePid(pid);
    console.log(`Stopped ${label} (${pid}) via ${signal}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
