'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getConfig } from '@/app/actions/config';
import { getBaseName } from '@/lib/path';
import { buildCommandPaletteRepoNavigation } from '@/lib/command-palette-routing';
import { cn } from '@/lib/utils';
import { useEscapeDismiss } from '@/hooks/use-escape-dismiss';

type CommandPaletteRepoItem = {
  path: string;
  displayName: string;
};

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentRepos, setRecentRepos] = useState<string[]>([]);
  const [repoAliases, setRepoAliases] = useState<Record<string, string | null | undefined>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const loadRecentRepos = useCallback(async () => {
    try {
      const config = await getConfig();
      setRecentRepos(config.recentRepos ?? []);
      const aliases: Record<string, string | null | undefined> = {};
      for (const [repoPath, settings] of Object.entries(config.repoSettings ?? {})) {
        aliases[repoPath] = settings.alias;
      }
      setRepoAliases(aliases);
    } catch (error) {
      console.error('Failed to load command palette repositories:', error);
      setRecentRepos([]);
      setRepoAliases({});
    }
  }, []);

  const recentRepositories = useMemo<CommandPaletteRepoItem[]>(() => {
    return recentRepos.map((repoPath) => ({
      path: repoPath,
      displayName: repoAliases[repoPath]?.trim() || getBaseName(repoPath),
    }));
  }, [recentRepos, repoAliases]);

  const filteredRepositories = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return recentRepositories;

    return recentRepositories.filter((repo) => {
      const name = repo.displayName.toLowerCase();
      const repoPath = repo.path.toLowerCase();
      return name.includes(keyword) || repoPath.includes(keyword);
    });
  }, [query, recentRepositories]);

  const closePalette = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const activeIndex =
    filteredRepositories.length === 0
      ? -1
      : Math.min(selectedIndex, filteredRepositories.length - 1);

  const selectRepository = useCallback(
    (repoPath: string) => {
      closePalette();
      const navigation = buildCommandPaletteRepoNavigation({
        pathname,
        search: searchParams.toString(),
        repoPath,
      });
      if (navigation.method === 'replace') {
        router.replace(navigation.href);
        return;
      }
      router.push(navigation.href);
    },
    [closePalette, pathname, router, searchParams]
  );

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      const isCommandOpenShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isCommandOpenShortcut) {
        event.preventDefault();
        setIsOpen(true);
        void loadRecentRepos();
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [loadRecentRepos]);

  useEscapeDismiss(isOpen, closePalette);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 px-4 py-16"
      onMouseDown={closePalette}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-base-300 p-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (filteredRepositories.length > 0) {
                  setSelectedIndex((current) => (current + 1) % filteredRepositories.length);
                }
                return;
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (filteredRepositories.length > 0) {
                  setSelectedIndex((current) =>
                    current <= 0 ? filteredRepositories.length - 1 : current - 1
                  );
                }
                return;
              }

              if (event.key === 'Enter') {
                event.preventDefault();
                const selectedRepo = activeIndex >= 0 ? filteredRepositories[activeIndex] : null;
                if (selectedRepo) {
                  selectRepository(selectedRepo.path);
                }
              }
            }}
            placeholder="Type a command..."
            className="input input-ghost w-full text-base focus:outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider opacity-60">
            Recent repositories
          </div>

          {recentRepositories.length === 0 && (
            <div className="px-4 py-6 text-sm opacity-60">No recently opened repositories yet.</div>
          )}

          {recentRepositories.length > 0 && filteredRepositories.length === 0 && (
            <div className="px-4 py-6 text-sm opacity-60">No matching repositories.</div>
          )}

          {filteredRepositories.map((repo, index) => {
            const repoDisplayName = repo.displayName;
            return (
              <button
                key={repo.path}
                type="button"
                className={cn(
                  'flex w-full items-center justify-between gap-4 px-4 py-3 text-left',
                  activeIndex === index ? 'bg-base-200' : 'hover:bg-base-200/70'
                )}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => selectRepository(repo.path)}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{repoDisplayName}</div>
                  <div className="truncate text-xs opacity-65">{repo.path}</div>
                </div>
                <span className="text-xs opacity-60">Open</span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-base-300 px-4 py-2 text-xs opacity-60">
          Use ↑ ↓ to navigate, Enter to open, Esc to close.
        </div>
      </div>
    </div>
  );
}
