import path from 'node:path';
import { getLocalDb } from './local-db.ts';
import { getProjectPrimaryFolderPath, isSameOrNestedPath, normalizeProjectFolderPath } from './project-folders.ts';
import { findProjectByFolderPath, getProjectById } from './store.ts';

export type ResolvedProjectActivityFilter = {
  projectId: string | null;
  projectPath: string | null;
  folderPaths: string[];
  filterColumn: 'project_id' | 'project_path';
  filterValue: string;
};

export function resolveProjectActivityFilter(
  projectReference?: string | null,
): ResolvedProjectActivityFilter | null {
  const trimmedReference = projectReference?.trim();
  if (!trimmedReference) return null;

  const projectById = getProjectById(trimmedReference);
  if (projectById) {
    return {
      projectId: projectById.id,
      projectPath: getProjectPrimaryFolderPath(projectById),
      folderPaths: projectById.folderPaths,
      filterColumn: 'project_id',
      filterValue: projectById.id,
    };
  }

  if (!path.isAbsolute(trimmedReference)) {
    return {
      projectId: null,
      projectPath: trimmedReference,
      folderPaths: [],
      filterColumn: 'project_path',
      filterValue: trimmedReference,
    };
  }

  const normalizedProjectPath = normalizeProjectFolderPath(trimmedReference);
  const projectByFolderPath = findProjectByFolderPath(normalizedProjectPath);
  if (projectByFolderPath) {
    return {
      projectId: projectByFolderPath.id,
      projectPath: getProjectPrimaryFolderPath(projectByFolderPath),
      folderPaths: projectByFolderPath.folderPaths,
      filterColumn: 'project_id',
      filterValue: projectByFolderPath.id,
    };
  }

  return {
    projectId: null,
    projectPath: normalizedProjectPath,
    folderPaths: [normalizedProjectPath],
    filterColumn: 'project_path',
    filterValue: normalizedProjectPath,
  };
}

function matchesStoredProjectFolder(
  folderPaths: string[],
  candidatePath?: string | null,
): boolean {
  const trimmedCandidate = candidatePath?.trim();
  if (!trimmedCandidate || !path.isAbsolute(trimmedCandidate)) {
    return false;
  }

  try {
    return folderPaths.some((folderPath) => isSameOrNestedPath(folderPath, trimmedCandidate));
  } catch {
    return false;
  }
}

function repairMissingProjectIds(
  tableName: 'sessions' | 'drafts',
  rowIdColumn: 'session_name' | 'id',
  projectReference?: string | null,
): void {
  const resolvedFilter = resolveProjectActivityFilter(projectReference);
  if (!resolvedFilter?.projectId || resolvedFilter.folderPaths.length === 0) {
    return;
  }

  const db = getLocalDb();
  const rows = db.prepare(`
    SELECT ${rowIdColumn} AS row_id, project_path, repo_path
    FROM ${tableName}
    WHERE project_id IS NULL OR TRIM(project_id) = ''
  `).all() as Array<{
    row_id: string;
    project_path: string | null;
    repo_path: string | null;
  }>;

  if (rows.length === 0) return;

  const updateProjectId = db.prepare(`
    UPDATE ${tableName}
    SET project_id = @projectId
    WHERE ${rowIdColumn} = @rowId
  `);

  for (const row of rows) {
    if (
      !matchesStoredProjectFolder(resolvedFilter.folderPaths, row.project_path)
      && !matchesStoredProjectFolder(resolvedFilter.folderPaths, row.repo_path)
    ) {
      continue;
    }

    updateProjectId.run({
      projectId: resolvedFilter.projectId,
      rowId: row.row_id,
    });
  }
}

export function repairMissingSessionProjectIds(projectReference?: string | null): void {
  repairMissingProjectIds('sessions', 'session_name', projectReference);
}

export function repairMissingDraftProjectIds(projectReference?: string | null): void {
  repairMissingProjectIds('drafts', 'id', projectReference);
}
