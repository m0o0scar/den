'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { useMemo, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/toaster';
import {
  APP_QUERY_CACHE_BUSTER,
  APP_QUERY_CACHE_MAX_AGE_MS,
  APP_QUERY_CACHE_STORAGE_KEY,
  APP_QUERY_DEFAULT_GC_TIME_MS,
  APP_QUERY_DEFAULT_STALE_TIME_MS,
  isPersistedQuery,
} from '@/lib/query-cache';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: APP_QUERY_DEFAULT_GC_TIME_MS,
        staleTime: APP_QUERY_DEFAULT_STALE_TIME_MS,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  }));
  const persister = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return createSyncStoragePersister({
      storage: window.localStorage,
      key: APP_QUERY_CACHE_STORAGE_KEY,
    });
  }, []);

  const content = (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
      <Toaster />
    </ThemeProvider>
  );

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        {content}
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: APP_QUERY_CACHE_BUSTER,
        maxAge: APP_QUERY_CACHE_MAX_AGE_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: isPersistedQuery,
        },
      }}
    >
      {content}
    </PersistQueryClientProvider>
  );
}
