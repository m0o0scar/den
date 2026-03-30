import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type LocalDbModule = typeof import('./local-db.ts');
type ProjectActivityServerModule = typeof import('./project-activity-server.ts');
type StoreModule = typeof import('./store.ts');

let tempHome = '';
let previousHome = '';
let previousUserProfile = '';
let localDbModule: LocalDbModule;
let projectActivityServerModule: ProjectActivityServerModule;
let storeModule: StoreModule;

before(async () => {
  tempHome = await mkdtemp(path.join(os.tmpdir(), 'palx-project-activity-server-test-'));
  previousHome = process.env.HOME || '';
  previousUserProfile = process.env.USERPROFILE || '';
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  localDbModule = await import('./local-db.ts');
  projectActivityServerModule = await import('./project-activity-server.ts');
  storeModule = await import('./store.ts');
});

beforeEach(() => {
  const db = localDbModule.getLocalDb();
  db.prepare('DELETE FROM sessions').run();
  db.prepare('DELETE FROM drafts').run();
  db.prepare('DELETE FROM project_entity_folders').run();
  db.prepare('DELETE FROM project_entities').run();
});

after(async () => {
  process.env.HOME = previousHome;
  process.env.USERPROFILE = previousUserProfile;
  if (tempHome) {
    await rm(tempHome, { recursive: true, force: true });
  }
});

function insertSessionRow(input: {
  sessionName: string;
  projectId?: string | null;
  projectPath?: string | null;
  repoPath?: string | null;
}) {
  const db = localDbModule.getLocalDb();
  db.prepare(`
    INSERT INTO sessions (
      session_name, project_id, project_path, workspace_path, workspace_mode,
      active_repo_path, repo_path, agent, model, timestamp
    ) VALUES (
      @sessionName, @projectId, @projectPath, @workspacePath, 'folder',
      @activeRepoPath, @repoPath, 'codex', 'gpt-5.4', '2026-03-30T07:00:00.000Z'
    )
  `).run({
    sessionName: input.sessionName,
    projectId: input.projectId ?? null,
    projectPath: input.projectPath ?? '',
    workspacePath: input.projectPath ?? input.repoPath ?? '',
    activeRepoPath: input.repoPath ?? null,
    repoPath: input.repoPath ?? null,
  });
}

function insertDraftRow(input: {
  id: string;
  projectId?: string | null;
  projectPath?: string | null;
  repoPath?: string | null;
}) {
  const db = localDbModule.getLocalDb();
  db.prepare(`
    INSERT INTO drafts (
      id, project_id, project_path, repo_path, branch_name, git_contexts_json, message,
      attachment_paths_json, agent_provider, model, reasoning_effort, timestamp, title,
      startup_script, dev_server_script, session_mode
    ) VALUES (
      @id, @projectId, @projectPath, @repoPath, 'main', NULL, 'Draft body',
      '[]', 'codex', 'gpt-5.4', 'medium', '2026-03-30T07:00:00.000Z', 'Draft title',
      '', '', 'fast'
    )
  `).run({
    id: input.id,
    projectId: input.projectId ?? null,
    projectPath: input.projectPath ?? '',
    repoPath: input.repoPath ?? null,
  });
}

describe('project activity server helpers', () => {
  it('resolves both project ids and legacy folder paths to the canonical project_id filter', () => {
    const primaryPath = path.join(tempHome, 'project-primary');
    const secondaryPath = path.join(tempHome, 'project-secondary');
    const project = storeModule.addProject({
      name: 'Activity Project',
      folderPaths: [primaryPath, secondaryPath],
    });

    assert.deepEqual(
      projectActivityServerModule.resolveProjectActivityFilter(project.id),
      {
        projectId: project.id,
        projectPath: primaryPath,
        folderPaths: [primaryPath, secondaryPath],
        filterColumn: 'project_id',
        filterValue: project.id,
      },
    );

    assert.deepEqual(
      projectActivityServerModule.resolveProjectActivityFilter(secondaryPath),
      {
        projectId: project.id,
        projectPath: primaryPath,
        folderPaths: [primaryPath, secondaryPath],
        filterColumn: 'project_id',
        filterValue: project.id,
      },
    );
  });

  it('backfills legacy session rows using associated project folders', () => {
    const primaryPath = path.join(tempHome, 'session-project-primary');
    const secondaryPath = path.join(tempHome, 'session-project-secondary');
    const project = storeModule.addProject({
      name: 'Session Project',
      folderPaths: [primaryPath, secondaryPath],
    });

    insertSessionRow({
      sessionName: 'session-legacy',
      projectPath: secondaryPath,
      repoPath: path.join(secondaryPath, 'repo-b'),
    });

    projectActivityServerModule.repairMissingSessionProjectIds(project.id);

    const repairedRow = localDbModule.getLocalDb()
      .prepare('SELECT project_id FROM sessions WHERE session_name = ?')
      .get('session-legacy') as { project_id: string };
    assert.equal(repairedRow.project_id, project.id);
  });

  it('backfills legacy draft rows using nested repo paths under associated folders', () => {
    const primaryPath = path.join(tempHome, 'draft-project-primary');
    const secondaryPath = path.join(tempHome, 'draft-project-secondary');
    const project = storeModule.addProject({
      name: 'Draft Project',
      folderPaths: [primaryPath, secondaryPath],
    });

    insertDraftRow({
      id: 'draft-legacy',
      projectPath: path.join(secondaryPath, 'nested-workspace'),
      repoPath: path.join(secondaryPath, 'nested-workspace', 'repo-b'),
    });

    projectActivityServerModule.repairMissingDraftProjectIds(secondaryPath);

    const repairedRow = localDbModule.getLocalDb()
      .prepare('SELECT project_id FROM drafts WHERE id = ?')
      .get('draft-legacy') as { project_id: string };
    assert.equal(repairedRow.project_id, project.id);
  });
});
