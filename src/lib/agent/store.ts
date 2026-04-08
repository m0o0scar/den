import {
  clearHistory,
  compact,
  deleteSessionState,
  flush,
  getNextHistoryOrdinal as getNextPersistedHistoryOrdinal,
  queueHistoryUpserts,
  queueRuntimePatch,
  readHistory,
  readRuntime,
  replaceHistory,
  type SessionHotStoreHistoryPage,
} from '@/lib/agent/session-hot-store';
import type {
  AgentProvider,
  ReasoningEffort,
  SessionAgentHistoryInput,
  SessionAgentHistoryItem,
  SessionAgentRunState,
  SessionAgentRuntimeState,
} from '@/lib/types';

export type SessionHistoryQuery = {
  threadId?: string;
  turnId?: string;
  limit?: number;
  beforeOrdinal?: number;
};

export type SessionHistoryPage = SessionHotStoreHistoryPage;

export function readSessionRuntime(sessionName: string): SessionAgentRuntimeState | null {
  return readRuntime(sessionName);
}

export function updateSessionRuntime(
  sessionName: string,
  updates: {
    agentProvider?: AgentProvider;
    model?: string;
    reasoningEffort?: ReasoningEffort | null;
    threadId?: string | null;
    activeTurnId?: string | null;
    runState?: SessionAgentRunState | null;
    lastError?: string | null;
    lastActivityAt?: string | null;
  },
): SessionAgentRuntimeState | null {
  return queueRuntimePatch(sessionName, updates);
}

export function listSessionHistory(
  sessionName: string,
  query: SessionHistoryQuery = {},
): SessionAgentHistoryItem[] {
  return readHistory(sessionName, query).history;
}

export function readSessionHistoryPage(
  sessionName: string,
  query: SessionHistoryQuery = {},
): SessionHistoryPage {
  return readHistory(sessionName, query);
}

export function getNextHistoryOrdinal(sessionName: string): number {
  return getNextPersistedHistoryOrdinal(sessionName);
}

export function upsertSessionHistoryEntries(
  sessionName: string,
  entries: SessionAgentHistoryInput[],
): void {
  queueHistoryUpserts(sessionName, entries);
}

export function replaceSessionHistoryEntries(
  sessionName: string,
  entries: SessionAgentHistoryInput[],
): void {
  replaceHistory(sessionName, entries);
}

export function clearSessionHistory(sessionName: string): void {
  clearHistory(sessionName);
}

export function flushSessionState(sessionName: string): void {
  flush(sessionName);
}

export function compactSessionHistory(sessionName: string): void {
  compact(sessionName);
}

export { deleteSessionState };
