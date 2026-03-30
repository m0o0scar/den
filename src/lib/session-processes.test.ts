import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  listTrackedSessionProcesses,
  stopAllTrackedSessionProcesses,
  upsertTrackedSessionProcess,
} from './session-processes.ts';

let tempHome = '';
let previousHome = '';
let previousUserProfile = '';
const originalKill = process.kill.bind(process);

before(async () => {
  tempHome = await mkdtemp(path.join(os.tmpdir(), 'palx-session-processes-test-'));
  previousHome = process.env.HOME || '';
  previousUserProfile = process.env.USERPROFILE || '';
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
});

after(async () => {
  process.kill = originalKill;
  process.env.HOME = previousHome;
  process.env.USERPROFILE = previousUserProfile;
  if (tempHome) {
    await rm(tempHome, { recursive: true, force: true });
  }
});

describe('stopAllTrackedSessionProcesses', () => {
  it('returns lingering survivors in the failure result', async () => {
    const alivePids = new Set([101, 102]);
    process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
      const normalizedPid = Math.abs(pid);
      if (signal === 0 || signal === undefined) {
        if (!alivePids.has(normalizedPid)) {
          const error = new Error(`No such process: ${normalizedPid}`) as Error & { code?: string };
          error.code = 'ESRCH';
          throw error;
        }
        return true;
      }

      if (normalizedPid === 102) {
        alivePids.delete(normalizedPid);
      }
      return true;
    }) as typeof process.kill;

    await upsertTrackedSessionProcess({
      id: 'dev-server-1',
      role: 'dev-server',
      source: 'ui-dev-button',
      sessionName: 'session-1',
      projectPath: 'project-1',
      workspacePath: '/tmp/workspace',
      command: 'npm run dev',
      pid: 101,
      shellKind: 'posix',
      startedAt: '2026-03-30T00:00:00.000Z',
    });
    await upsertTrackedSessionProcess({
      id: 'startup-script-1',
      role: 'startup-script',
      source: 'startup-script',
      sessionName: 'session-1',
      projectPath: 'project-1',
      workspacePath: '/tmp/workspace',
      command: 'npm run setup',
      pid: 102,
      shellKind: 'posix',
      startedAt: '2026-03-30T00:00:00.000Z',
    });

    const result = await stopAllTrackedSessionProcesses('project-1', 'session-1');

    assert.equal(result.success, false);
    assert.deepEqual(result.failures.map((entry) => entry.pid), [101]);
    assert.deepEqual(result.stopped.map((entry) => entry.pid), [102]);

    const remaining = await listTrackedSessionProcesses('project-1', 'session-1');
    assert.deepEqual(remaining.map((entry) => entry.pid), [101]);
  });
});
