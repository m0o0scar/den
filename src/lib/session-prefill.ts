type SessionPrefillProjectContext = {
  projectId?: string;
  projectPath?: string;
  repoPath?: string;
};

function normalizePathForComparison(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').replace(/\/+$/, '');
}

export function doesSessionPrefillMatchProject(
  context: SessionPrefillProjectContext,
  selectedProjectReference: string,
): boolean {
  const normalizedSelectedProjectReference = selectedProjectReference.trim();
  if (!normalizedSelectedProjectReference) {
    return false;
  }

  if (context.projectId?.trim() === normalizedSelectedProjectReference) {
    return true;
  }

  const candidatePaths = [context.projectPath, context.repoPath]
    .map((pathValue) => pathValue?.trim() || '')
    .filter(Boolean)
    .map(normalizePathForComparison);

  return candidatePaths.includes(normalizePathForComparison(normalizedSelectedProjectReference));
}
