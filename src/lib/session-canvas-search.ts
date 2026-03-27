import fs from 'node:fs/promises';
import path from 'node:path';

import { REPO_ENTRY_SKIP_DIRS } from './repo-entry-list.ts';
import { getFileTypeByExtension, isBinaryContent } from './utils.ts';

const MAX_SEARCH_RESULTS = 50;
const MAX_SEARCH_DIRS = 15000;
const MAX_SEARCH_FILES = 10000;
const MAX_CONTENT_BYTES = 256 * 1024;
const MIN_QUERY_LENGTH = 2;
const SNIPPET_CONTEXT_CHARS = 48;

export type SessionCanvasWorkspaceSearchMatchKind = 'path' | 'content';

export type SessionCanvasWorkspaceSearchResult = {
  path: string;
  relativePath: string;
  name: string;
  matchKinds: SessionCanvasWorkspaceSearchMatchKind[];
  snippet?: string;
};

type SearchCandidate = SessionCanvasWorkspaceSearchResult & {
  rank: number;
};

function getPathMatchRank(relativePath: string, name: string, lowerQuery: string): number | null {
  const lowerRelativePath = relativePath.toLowerCase();
  const lowerName = name.toLowerCase();

  if (lowerName.startsWith(lowerQuery) || lowerRelativePath.startsWith(lowerQuery)) {
    return 0;
  }

  if (lowerRelativePath.includes(lowerQuery)) {
    return 1;
  }

  return null;
}

function extractSnippet(content: string, matchIndex: number, queryLength: number): string {
  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(content.length, matchIndex + queryLength + SNIPPET_CONTEXT_CHARS);
  const prefixEllipsis = start > 0 ? '…' : '';
  const suffixEllipsis = end < content.length ? '…' : '';
  const snippet = content
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .trim();

  return `${prefixEllipsis}${snippet}${suffixEllipsis}`;
}

function compareResults(left: SearchCandidate, right: SearchCandidate): number {
  if (left.rank !== right.rank) {
    return left.rank - right.rank;
  }

  if (left.name.length !== right.name.length) {
    return left.name.length - right.name.length;
  }

  if (left.relativePath.length !== right.relativePath.length) {
    return left.relativePath.length - right.relativePath.length;
  }

  return left.relativePath.localeCompare(right.relativePath);
}

export async function searchSessionCanvasWorkspaceEntries(
  workspacePath: string,
  query: string,
): Promise<SessionCanvasWorkspaceSearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const lowerQuery = trimmedQuery.toLowerCase();
  const queue = [workspacePath];
  const matches = new Map<string, SearchCandidate>();
  let scannedDirs = 0;
  let scannedFiles = 0;

  while (
    queue.length > 0
    && scannedDirs < MAX_SEARCH_DIRS
    && scannedFiles < MAX_SEARCH_FILES
  ) {
    const currentDir = queue.shift();
    if (!currentDir) break;
    scannedDirs += 1;

    let entries: Array<import('node:fs').Dirent>;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.sort((left, right) => {
      if (left.isDirectory() && !right.isDirectory()) return -1;
      if (!left.isDirectory() && right.isDirectory()) return 1;
      return left.name.localeCompare(right.name);
    });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(workspacePath, fullPath);

      if (!relativePath || relativePath.startsWith('..')) {
        continue;
      }

      if (entry.isDirectory()) {
        if (!REPO_ENTRY_SKIP_DIRS.has(entry.name)) {
          queue.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      scannedFiles += 1;
      const pathMatchRank = getPathMatchRank(relativePath, entry.name, lowerQuery);
      const existing = matches.get(fullPath);

      if (pathMatchRank !== null) {
        matches.set(fullPath, {
          path: fullPath,
          relativePath,
          name: entry.name,
          matchKinds: existing
            ? Array.from(new Set([...existing.matchKinds, 'path']))
            : ['path'],
          snippet: existing?.snippet,
          rank: existing ? Math.min(existing.rank, pathMatchRank) : pathMatchRank,
        });
      }

      let stats: Awaited<ReturnType<typeof fs.stat>> | null = null;
      try {
        stats = await fs.stat(fullPath);
      } catch {
        continue;
      }

      if (!stats.isFile() || stats.size === 0 || stats.size > MAX_CONTENT_BYTES) {
        continue;
      }

      const fileType = getFileTypeByExtension(fullPath);
      if (fileType === 'binary') {
        continue;
      }

      let content: string;
      try {
        content = await fs.readFile(fullPath, 'utf8');
      } catch {
        continue;
      }

      if (fileType === 'unknown' && isBinaryContent(content)) {
        continue;
      }

      const matchIndex = content.toLowerCase().indexOf(lowerQuery);
      if (matchIndex === -1) {
        continue;
      }

      const contentSnippet = extractSnippet(content, matchIndex, trimmedQuery.length);
      const latest = matches.get(fullPath);
      const nextRank = latest ? latest.rank : 2;
      matches.set(fullPath, {
        path: fullPath,
        relativePath,
        name: entry.name,
        matchKinds: latest
          ? Array.from(new Set([...latest.matchKinds, 'content']))
          : ['content'],
        snippet: contentSnippet,
        rank: nextRank,
      });

      if (matches.size >= MAX_SEARCH_RESULTS * 3) {
        const trimmed = [...matches.values()]
          .sort(compareResults)
          .slice(0, MAX_SEARCH_RESULTS * 2);
        matches.clear();
        for (const candidate of trimmed) {
          matches.set(candidate.path, candidate);
        }
      }
    }
  }

  return [...matches.values()]
    .sort(compareResults)
    .slice(0, MAX_SEARCH_RESULTS)
    .map((candidate) => ({
      path: candidate.path,
      relativePath: candidate.relativePath,
      name: candidate.name,
      matchKinds: candidate.matchKinds,
      snippet: candidate.snippet,
    }));
}
