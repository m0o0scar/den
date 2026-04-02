'use client';

import { useQuery } from '@tanstack/react-query';
import type { AgentProvider, AppStatus, ProviderCatalogEntry } from '@/lib/types';
import {
  queryKeys,
  readLegacyAgentStatusCache,
} from '@/lib/query-cache';

export type AgentStatusResponse = {
  providers: ProviderCatalogEntry[];
  defaultProvider: AgentProvider;
  status: AppStatus | null;
  error?: string;
};

const SUPPORTED_AGENT_PROVIDERS: AgentProvider[] = ['codex', 'gemini', 'cursor'];

function buildLegacyInitialData(provider: AgentProvider): AgentStatusResponse | undefined {
  if (typeof window === 'undefined') return undefined;

  const legacyCatalog = readLegacyAgentStatusCache(window.localStorage, provider);
  if (!legacyCatalog) return undefined;

  return {
    providers: SUPPORTED_AGENT_PROVIDERS.map((entry) => ({
      id: entry,
      label: entry === 'codex' ? 'Codex CLI' : entry === 'gemini' ? 'Gemini CLI' : 'Cursor Agent CLI',
      description: '',
      available: true,
    })),
    defaultProvider: 'codex',
    status: {
      provider,
      installed: legacyCatalog.models.length > 0,
      version: null,
      loggedIn: legacyCatalog.models.length > 0,
      account: null,
      installCommand: '',
      models: legacyCatalog.models,
      defaultModel: legacyCatalog.defaultModel,
    },
  };
}

export function useAgentStatus(
  provider: AgentProvider,
  options: { enabled?: boolean; staleTime?: number } = {},
) {
  return useQuery<AgentStatusResponse>({
    queryKey: queryKeys.agentStatus(provider),
    queryFn: async () => {
      const response = await fetch(`/api/agent/status?provider=${encodeURIComponent(provider)}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null) as AgentStatusResponse | null;
      if (!payload) {
        throw new Error('Failed to load agent runtime status.');
      }
      return payload;
    },
    enabled: options.enabled ?? true,
    meta: { persist: true },
    initialData: () => buildLegacyInitialData(provider),
    placeholderData: (previousData) => previousData,
    staleTime: options.staleTime ?? 60_000,
  });
}
