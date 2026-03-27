import type { SessionAgentRunState } from './types.ts';

type HomeProjectSessionLike = {
  projectId?: string | null;
  projectPath?: string | null;
  repoPath?: string | null;
  runState?: SessionAgentRunState | null;
};

const TERMINAL_SESSION_RUN_STATES = new Set<SessionAgentRunState>([
  'completed',
  'cancelled',
  'error',
]);

export function isActiveHomeProjectSession(runState?: SessionAgentRunState | null): boolean {
  if (!runState) return true;
  return !TERMINAL_SESSION_RUN_STATES.has(runState);
}

export function countActiveHomeProjectSessionsByProject(
  sessions: HomeProjectSessionLike[],
  resolveProjectKey: (session: HomeProjectSessionLike) => string,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const session of sessions) {
    if (!isActiveHomeProjectSession(session.runState)) {
      continue;
    }

    const projectKey = resolveProjectKey(session).trim();
    if (!projectKey) {
      continue;
    }

    counts.set(projectKey, (counts.get(projectKey) ?? 0) + 1);
  }

  return counts;
}
