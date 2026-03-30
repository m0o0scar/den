import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  getAgentSessionManagerState,
  shutdownManagedSessionRun,
} from './session-run-state.ts';
import type { RuntimeProcessEntry } from './process-tree.ts';
import type { SessionAgentTurnDiagnostics } from '../types.ts';

function createDiagnostics(): SessionAgentTurnDiagnostics {
  return {
    transport: 'codex-app-server',
    runState: 'running',
    queuedAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
    startedAt: '2026-03-30T00:00:01.000Z',
    completedAt: null,
    timeToTurnStartMs: 1000,
    currentStepKey: null,
    steps: [],
  };
}

afterEach(() => {
  const state = getAgentSessionManagerState();
  state.runs.clear();
  state.lastDiagnostics.clear();
});

describe('shutdownManagedSessionRun', () => {
  it('aborts the active run, terminates managed processes, and clears manager state', async () => {
    const state = getAgentSessionManagerState();
    const abortController = new AbortController();
    let aborted = false;
    abortController.signal.addEventListener('abort', () => {
      aborted = true;
    });

    const alivePids = new Set([200, 201]);
    const processTables: RuntimeProcessEntry[][] = [
      [{ pid: 201, ppid: 200, state: 'S', command: 'npm run child' }],
      [],
    ];
    let processTableIndex = 0;
    const terminated: number[] = [];

    const promise = new Promise<void>((resolve) => {
      abortController.signal.addEventListener('abort', () => {
        resolve();
      }, { once: true });
    });

    state.runs.set('session-1', {
      abortController,
      promise,
      diagnostics: createDiagnostics(),
      runtimePid: 200,
    });
    state.lastDiagnostics.set('session-1', createDiagnostics());

    const result = await shutdownManagedSessionRun('session-1', {
      getState: () => state,
      listRuntimeProcesses: async () => processTables[Math.min(processTableIndex++, processTables.length - 1)] ?? [],
      isProcessAlive: (pid) => alivePids.has(pid),
      terminateProcess: async ({ pid }) => {
        terminated.push(pid);
        alivePids.delete(pid);
        return true;
      },
    });

    assert.equal(aborted, true);
    assert.equal(result.success, true);
    assert.equal(result.wasRunning, true);
    assert.deepEqual(terminated, [201, 200]);
    assert.equal(state.runs.has('session-1'), false);
    assert.equal(state.lastDiagnostics.has('session-1'), false);
  });

  it('reports lingering runtime processes when shutdown verification fails', async () => {
    const state = getAgentSessionManagerState();
    const abortController = new AbortController();
    const promise = new Promise<void>((resolve) => {
      abortController.signal.addEventListener('abort', () => {
        resolve();
      }, { once: true });
    });

    state.runs.set('session-2', {
      abortController,
      promise,
      diagnostics: createDiagnostics(),
      runtimePid: 300,
    });
    state.lastDiagnostics.set('session-2', createDiagnostics());

    const result = await shutdownManagedSessionRun('session-2', {
      getState: () => state,
      listRuntimeProcesses: async () => [{ pid: 301, ppid: 300, state: 'S', command: 'npm run stuck-child' }],
      isProcessAlive: (pid) => pid === 300 || pid === 301,
      terminateProcess: async () => false,
    });

    assert.equal(result.success, false);
    assert.equal(result.runtimeStillAlive, true);
    assert.deepEqual(result.lingeringSubprocesses.map((entry) => entry.pid), [301]);
    assert.deepEqual(result.failures.map((failure) => failure.pid), [300, 301]);
    assert.equal(state.runs.has('session-2'), false);
    assert.equal(state.lastDiagnostics.has('session-2'), false);
  });
});
