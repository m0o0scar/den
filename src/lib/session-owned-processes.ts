import { terminateSessionTerminalSessions } from '@/app/actions/git';
import { shutdownManagedSessionRun, type SessionRunShutdownResult } from '@/lib/agent/session-run-state';
import {
  stopAllTrackedSessionProcesses,
  type StopAllTrackedSessionProcessesResult,
} from '@/lib/session-processes';

export type SessionOwnedProcessShutdownResult = {
  success: boolean;
  failures: string[];
  runtime: SessionRunShutdownResult;
  trackedProcesses: StopAllTrackedSessionProcessesResult;
  terminals: Awaited<ReturnType<typeof terminateSessionTerminalSessions>>;
};

export async function shutdownSessionOwnedProcesses(input: {
  projectKey: string;
  sessionName: string;
}): Promise<SessionOwnedProcessShutdownResult> {
  const runtime = await shutdownManagedSessionRun(input.sessionName);
  const trackedProcesses = await stopAllTrackedSessionProcesses(input.projectKey, input.sessionName);
  const terminals = await terminateSessionTerminalSessions(input.sessionName);

  const failures: string[] = [];
  for (const failure of runtime.failures) {
    failures.push(failure.message);
  }
  for (const failure of trackedProcesses.failures) {
    failures.push(`Tracked process ${failure.role} (${failure.pid}) is still alive.`);
  }
  for (const lingeringSession of terminals.lingeringSessions) {
    failures.push(`Terminal session ${lingeringSession} is still alive.`);
  }

  return {
    success: failures.length === 0,
    failures,
    runtime,
    trackedProcesses,
    terminals,
  };
}
