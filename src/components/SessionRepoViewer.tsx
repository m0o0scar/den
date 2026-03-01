'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useGitBranches, useGitLog } from '@/hooks/use-git';
import { Commit } from '@/lib/types';
import { CommitChangesView } from './git/commit-changes-view';

function formatCommitDate(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString();
}

function commitLabel(commit: Commit): string {
  return `${commit.hash} ${commit.message}`.trim();
}

type SessionRepoViewerProps = {
  repoPath: string;
  branchHint?: string;
};

export function SessionRepoViewer({ repoPath, branchHint }: SessionRepoViewerProps) {
  const [manualSelectedCommitHash, setManualSelectedCommitHash] = useState<string | null>(null);
  const { data: branchData } = useGitBranches(repoPath);
  const {
    data: log,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGitLog(repoPath, 200, { scope: 'current' });
  const commits = useMemo(() => log?.all ?? [], [log]);
  const currentBranch = branchData?.current?.trim() || branchHint?.trim() || 'unknown';
  const selectedCommitHash = useMemo(() => {
    if (commits.length === 0) return null;
    if (manualSelectedCommitHash && commits.some((commit) => commit.hash === manualSelectedCommitHash)) {
      return manualSelectedCommitHash;
    }
    return commits[0].hash;
  }, [commits, manualSelectedCommitHash]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-[#0d1117]">
      <div className="flex min-h-0 flex-[2] flex-col border-b border-slate-200 dark:border-[#30363d]">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-200 px-3 text-[11px] font-semibold text-slate-600 dark:border-[#30363d] dark:bg-[#161b22] dark:text-slate-400">
          <div className="flex min-w-0 items-center gap-2 uppercase tracking-wide">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"></span>
            <span className="truncate">Repo Diff</span>
            <span className="truncate opacity-70 normal-case" title={currentBranch}>
              {currentBranch}
            </span>
          </div>
          <span className="shrink-0 text-[10px] opacity-70">
            {commits.length} commit{commits.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          {selectedCommitHash ? (
            <CommitChangesView repoPath={repoPath} commitHash={selectedCommitHash} />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs text-slate-500 dark:text-slate-400">
              {isLoading ? 'Loading commit diff...' : 'No commits found on this branch.'}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-200 px-3 text-[11px] font-semibold text-slate-600 dark:border-[#30363d] dark:bg-[#161b22] dark:text-slate-400">
          <span className="uppercase tracking-wide">Commit History</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs h-6 min-h-6 w-7 border-none p-0 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#30363d]/60"
            onClick={() => void refetch()}
            title="Refresh commit history"
            aria-label="Refresh commit history"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              <span className="loading loading-spinner loading-sm"></span>
            </div>
          ) : isError ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs text-red-500 dark:text-red-300">
              {error instanceof Error ? error.message : 'Failed to load commit history'}
            </div>
          ) : commits.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs text-slate-500 dark:text-slate-400">
              No commits found on this branch.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-[#30363d]">
              {commits.map((commit) => {
                const isSelected = selectedCommitHash === commit.hash;
                return (
                  <button
                    key={commit.hash}
                    type="button"
                    onClick={() => setManualSelectedCommitHash(commit.hash)}
                    className={`w-full px-3 py-2 text-left transition-colors ${isSelected
                      ? 'bg-blue-100/80 dark:bg-[#1f2a3d]'
                      : 'hover:bg-slate-100 dark:hover:bg-[#161b22]'
                      }`}
                    title={commitLabel(commit)}
                  >
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 dark:bg-[#30363d]">{commit.hash}</span>
                      <span className="truncate">{formatCommitDate(commit.date)}</span>
                    </div>
                    <div className="mt-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                      {commit.message || '(no subject)'}
                    </div>
                    <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {commit.author_name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
