import { getBaseName } from './path.ts';

import type { SessionGitRepoContext } from './types.ts';

export const SESSION_TITLE_MAX_LENGTH = 120;

export type AttachmentContext = {
  attachmentPaths: string[];
  attachmentNames: string[];
  attachmentPathByName: Map<string, string>;
};

export function deriveSessionTitleFromTaskDescription(taskDescription: string): string | undefined {
  const firstNonEmptyLine = taskDescription
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstNonEmptyLine) return undefined;
  return firstNonEmptyLine.slice(0, SESSION_TITLE_MAX_LENGTH);
}

export function normalizeAttachmentPaths(paths: string[]): string[] {
  return Array.from(new Set(paths.map((entry) => entry.trim()).filter(Boolean)));
}

export function buildAttachmentContext(paths: string[]): AttachmentContext {
  const attachmentPaths = normalizeAttachmentPaths(paths);
  const attachmentPathByName = new Map<string, string>();

  for (const attachmentPath of attachmentPaths) {
    const baseName = getBaseName(attachmentPath).trim();
    if (!baseName || attachmentPathByName.has(baseName)) {
      continue;
    }
    attachmentPathByName.set(baseName, attachmentPath);
  }

  return {
    attachmentPaths,
    attachmentNames: Array.from(attachmentPathByName.keys()),
    attachmentPathByName,
  };
}

export function normalizePathForComparison(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').replace(/\/+$/, '');
}

export function toProjectRelativeRepoPath(projectPath: string, repoPath: string): string {
  const normalizedProjectPath = normalizePathForComparison(projectPath);
  const normalizedRepoPath = normalizePathForComparison(repoPath);

  if (!normalizedProjectPath || !normalizedRepoPath) return repoPath;
  if (normalizedRepoPath === normalizedProjectPath) return '.';

  const projectPrefix = `${normalizedProjectPath}/`;
  if (normalizedRepoPath.startsWith(projectPrefix)) {
    return normalizedRepoPath.slice(projectPrefix.length);
  }

  return repoPath;
}

export function buildProjectRepoLaunchContext(
  projectPath: string,
  projectRepoPaths: string[],
): {
  projectRepoPaths: string[];
  projectRepoRelativePaths: string[];
} {
  const normalizedProjectRepoPaths = normalizeAttachmentPaths(projectRepoPaths);

  return {
    projectRepoPaths: normalizedProjectRepoPaths,
    projectRepoRelativePaths: normalizedProjectRepoPaths.map((repoPath) => (
      toProjectRelativeRepoPath(projectPath, repoPath)
    )),
  };
}

export function buildProjectRepoLaunchContextFromGitRepos(
  projectPath: string,
  gitRepos: SessionGitRepoContext[],
): {
  projectRepoPaths: string[];
  projectRepoRelativePaths: string[];
} {
  const projectRepoPaths = normalizeAttachmentPaths(
    gitRepos.map((repo) => repo.sourceRepoPath),
  );

  if (projectRepoPaths.length === 0) {
    return {
      projectRepoPaths: [],
      projectRepoRelativePaths: [],
    };
  }

  const relativePathByRepoPath = new Map<string, string>();
  for (const repo of gitRepos) {
    if (!repo.sourceRepoPath.trim()) continue;
    const relativePath = repo.relativeRepoPath?.trim()
      || toProjectRelativeRepoPath(projectPath, repo.sourceRepoPath);
    if (!relativePathByRepoPath.has(repo.sourceRepoPath)) {
      relativePathByRepoPath.set(repo.sourceRepoPath, relativePath);
    }
  }

  return {
    projectRepoPaths,
    projectRepoRelativePaths: projectRepoPaths.map((repoPath) => (
      relativePathByRepoPath.get(repoPath)
      || toProjectRelativeRepoPath(projectPath, repoPath)
    )),
  };
}
