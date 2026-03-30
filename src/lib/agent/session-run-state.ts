import {
  collectDescendantProcesses,
  parsePsProcessTable,
  type RuntimeProcessEntry,
} from '@/lib/agent/process-tree';
import { readCommandOutput } from '@/lib/agent/common';
import { isProcessAlive, terminateProcessGracefully } from '@/lib/session-processes';
import type { SessionAgentTurnDiagnostics } from '@/lib/types';

export type ActiveSessionRun = {
  abortController: AbortController;
  promise: Promise<void>;
  diagnostics: SessionAgentTurnDiagnostics;
  runtimePid: number | null;
};

export type SessionRunManagerState = {
  runs: Map<string, ActiveSessionRun>;
  lastDiagnostics: Map<string, SessionAgentTurnDiagnostics>;
};

export type SessionRunProcessShutdownFailure = {
  scope: 'runtime' | 'subprocess';
  pid: number;
  command?: string;
  message: string;
};

export type SessionRunShutdownResult = {
  success: boolean;
  wasRunning: boolean;
  runtimePid: number | null;
  failures: SessionRunProcessShutdownFailure[];
  lingeringSubprocesses: RuntimeProcessEntry[];
  runtimeStillAlive: boolean;
};

type SessionRunShutdownDeps = {
  getState: () => SessionRunManagerState;
  listRuntimeProcesses: () => Promise<RuntimeProcessEntry[]>;
  isProcessAlive: (pid: number) => boolean;
  terminateProcess: (options: { pid: number; processGroupId?: number }) => Promise<boolean>;
};

declare global {
  var __palxAgentSessionManagerState: SessionRunManagerState | undefined;
}

export function getAgentSessionManagerState(): SessionRunManagerState {
  if (!globalThis.__palxAgentSessionManagerState) {
    globalThis.__palxAgentSessionManagerState = {
      runs: new Map(),
      lastDiagnostics: new Map(),
    };
  }

  return globalThis.__palxAgentSessionManagerState;
}

async function readRuntimeProcessTable(): Promise<RuntimeProcessEntry[]> {
  if (process.platform === 'win32') {
    return [];
  }

  const result = await readCommandOutput('ps', ['-axo', 'pid=,ppid=,state=,command=']);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to read runtime process table.');
  }

  return parsePsProcessTable(result.stdout);
}

const DEFAULT_SHUTDOWN_DEPS: SessionRunShutdownDeps = {
  getState: getAgentSessionManagerState,
  listRuntimeProcesses: readRuntimeProcessTable,
  isProcessAlive,
  terminateProcess: async ({ pid, processGroupId }) => await terminateProcessGracefully({ pid, processGroupId }),
};

export async function listManagedRuntimeSubprocesses(
  runtimePid: number | null,
  deps: Pick<SessionRunShutdownDeps, 'listRuntimeProcesses'> = DEFAULT_SHUTDOWN_DEPS,
): Promise<RuntimeProcessEntry[]> {
  if (runtimePid === null || !Number.isInteger(runtimePid) || runtimePid <= 0) {
    return [];
  }

  const processTable = await deps.listRuntimeProcesses();
  return collectDescendantProcesses(processTable, runtimePid);
}

export async function terminateManagedRuntimeProcesses(
  runtimePid: number | null,
  deps: Pick<SessionRunShutdownDeps, 'listRuntimeProcesses' | 'isProcessAlive' | 'terminateProcess'> = DEFAULT_SHUTDOWN_DEPS,
): Promise<{
  lingeringSubprocesses: RuntimeProcessEntry[];
  runtimeStillAlive: boolean;
}> {
  if (runtimePid === null || !Number.isInteger(runtimePid) || runtimePid <= 0) {
    return {
      lingeringSubprocesses: [],
      runtimeStillAlive: false,
    };
  }

  const descendants = await listManagedRuntimeSubprocesses(runtimePid, deps)
    .catch(() => []);
  for (const entry of descendants.sort((left, right) => right.pid - left.pid)) {
    try {
      await deps.terminateProcess({ pid: entry.pid });
    } catch {
      // Verification below determines whether the subprocess survived.
    }
  }

  try {
    await deps.terminateProcess({ pid: runtimePid });
  } catch {
    // Verification below determines whether the runtime survived.
  }

  const lingeringSubprocesses = await listManagedRuntimeSubprocesses(runtimePid, deps)
    .catch(() => descendants.filter((entry) => deps.isProcessAlive(entry.pid)));
  const runtimeStillAlive = deps.isProcessAlive(runtimePid);

  return {
    lingeringSubprocesses,
    runtimeStillAlive,
  };
}

export async function shutdownManagedSessionRun(
  sessionId: string,
  deps: SessionRunShutdownDeps = DEFAULT_SHUTDOWN_DEPS,
): Promise<SessionRunShutdownResult> {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) {
    return {
      success: false,
      wasRunning: false,
      runtimePid: null,
      failures: [{
        scope: 'runtime',
        pid: 0,
        message: 'sessionId is required.',
      }],
      lingeringSubprocesses: [],
      runtimeStillAlive: false,
    };
  }

  const state = deps.getState();
  const activeRun = state.runs.get(normalizedSessionId);
  const runtimePid = activeRun?.runtimePid ?? null;

  if (activeRun) {
    activeRun.abortController.abort();
    try {
      await activeRun.promise;
    } catch {
      // Runtime promises may reject on cancellation; verification happens below.
    }
  }

  const termination = await terminateManagedRuntimeProcesses(runtimePid, deps);
  const failures: SessionRunProcessShutdownFailure[] = [];

  if (termination.runtimeStillAlive && runtimePid) {
    failures.push({
      scope: 'runtime',
      pid: runtimePid,
      message: `Agent runtime process ${runtimePid} is still alive.`,
    });
  }

  for (const entry of termination.lingeringSubprocesses) {
    failures.push({
      scope: 'subprocess',
      pid: entry.pid,
      command: entry.command,
      message: `Agent runtime subprocess ${entry.pid} is still alive.`,
    });
  }

  state.runs.delete(normalizedSessionId);
  state.lastDiagnostics.delete(normalizedSessionId);

  return {
    success: failures.length === 0,
    wasRunning: Boolean(activeRun),
    runtimePid,
    failures,
    lingeringSubprocesses: termination.lingeringSubprocesses,
    runtimeStillAlive: termination.runtimeStillAlive,
  };
}
