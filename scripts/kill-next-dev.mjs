#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
const APP_ROOT = process.cwd();
const PORT_RANGE = '3200-3299';
const dryRun = process.argv.includes('--dry-run');

function getPlatformCommand(command) {
  if (process.platform === 'darwin' && command === 'lsof') {
    return '/usr/sbin/lsof';
  }
  return command;
}

function run(command, args) {
  return spawnSync(getPlatformCommand(command), args, {
    cwd: APP_ROOT,
    env: process.env,
    encoding: 'utf8',
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getListeningPids() {
  const result = run('lsof', ['-t', '-nP', `-iTCP:${PORT_RANGE}`, '-sTCP:LISTEN']);
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

function getListeningPortLabels(pid) {
  const result = run('lsof', ['-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:LISTEN']);
  if (result.status !== 0) {
    return [];
  }

  return Array.from(new Set(
    (result.stdout ?? '')
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/:(32\d\d)\s+\(LISTEN\)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean)
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
  const pids = getListeningPids();
  if (pids.length === 0) {
    console.log(`No listening processes found on ${PORT_RANGE}`);
    return;
  }

  for (const pid of pids) {
    const label = getProcessLabel(pid);
    const ports = getListeningPortLabels(pid);
    if (dryRun) {
      const portLabel = ports.length > 0 ? ` on ${ports.join(', ')}` : '';
      console.log(`Would stop ${label} (${pid})${portLabel}`);
      continue;
    }
    const signal = await terminatePid(pid);
    const portLabel = ports.length > 0 ? ` on ${ports.join(', ')}` : '';
    console.log(`Stopped ${label} (${pid})${portLabel} via ${signal}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
