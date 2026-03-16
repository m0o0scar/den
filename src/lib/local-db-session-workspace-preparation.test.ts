import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

type LocalDbModule = typeof import('./local-db.ts');

let tempHome = '';
let previousHome = '';
let previousUserProfile = '';
let localDbModule: LocalDbModule;

before(async () => {
  tempHome = await mkdtemp(path.join(os.tmpdir(), 'palx-local-db-preparation-test-'));
  previousHome = process.env.HOME || '';
  previousUserProfile = process.env.USERPROFILE || '';
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  localDbModule = await import('./local-db.ts');
});

after(async () => {
  process.env.HOME = previousHome;
  process.env.USERPROFILE = previousUserProfile;
  if (tempHome) {
    await rm(tempHome, { recursive: true, force: true });
  }
});

describe('local DB session workspace preparation schema', () => {
  it('preserves local_source workspace mode during session migration', async () => {
    const dbPath = localDbModule.getLocalDbPath();
    await mkdir(path.dirname(dbPath), { recursive: true });

    const seededDb = new Database(dbPath);
    seededDb.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_name TEXT PRIMARY KEY,
        project_path TEXT NOT NULL DEFAULT '',
        workspace_path TEXT NOT NULL DEFAULT '',
        workspace_mode TEXT NOT NULL DEFAULT 'folder',
        active_repo_path TEXT,
        repo_path TEXT,
        worktree_path TEXT,
        branch_name TEXT,
        base_branch TEXT,
        agent TEXT NOT NULL,
        model TEXT NOT NULL,
        reasoning_effort TEXT,
        thread_id TEXT,
        active_turn_id TEXT,
        run_state TEXT,
        last_error TEXT,
        last_activity_at TEXT,
        title TEXT,
        dev_server_script TEXT,
        initialized INTEGER,
        timestamp TEXT NOT NULL
      );
    `);
    seededDb.prepare(`
      INSERT INTO sessions (
        session_name, project_path, workspace_path, workspace_mode, active_repo_path,
        repo_path, worktree_path, branch_name, base_branch,
        agent, model, timestamp
      ) VALUES (
        @sessionName, @projectPath, @workspacePath, @workspaceMode, @activeRepoPath,
        @repoPath, @worktreePath, @branchName, @baseBranch,
        @agent, @model, @timestamp
      )
    `).run({
      sessionName: 'local-source-session',
      projectPath: '/tmp/project',
      workspacePath: '/tmp/project',
      workspaceMode: 'local_source',
      activeRepoPath: '/tmp/project',
      repoPath: '/tmp/project',
      worktreePath: '/tmp/project',
      branchName: 'main',
      baseBranch: 'main',
      agent: 'codex',
      model: 'gpt-5',
      timestamp: new Date().toISOString(),
    });
    seededDb.close();

    const db = localDbModule.getLocalDb();
    const row = db.prepare(`
      SELECT workspace_mode, workspace_path, project_path, active_repo_path
      FROM sessions
      WHERE session_name = ?
    `).get('local-source-session') as {
      workspace_mode: string;
      workspace_path: string;
      project_path: string;
      active_repo_path: string | null;
    };

    assert.equal(row.workspace_mode, 'local_source');
    assert.equal(row.workspace_path, '/tmp/project');
    assert.equal(row.project_path, '/tmp/project');
    assert.equal(row.active_repo_path, '/tmp/project');
  });

  it('creates session_workspace_preparations with expected columns', () => {
    const db = localDbModule.getLocalDb();
    const columns = db.prepare('PRAGMA table_info(session_workspace_preparations)').all() as Array<{
      name: string;
    }>;
    const columnNames = new Set(columns.map((column) => column.name));

    for (const requiredColumn of [
      'preparation_id',
      'project_path',
      'context_fingerprint',
      'session_name',
      'payload_json',
      'status',
      'cancel_requested',
      'created_at',
      'updated_at',
      'expires_at',
      'consumed_at',
      'released_at',
    ]) {
      assert.equal(
        columnNames.has(requiredColumn),
        true,
        `expected session_workspace_preparations.${requiredColumn} to exist`,
      );
    }
  });

  it('adds launch-context repo snapshot columns and preparation indexes', () => {
    const db = localDbModule.getLocalDb();
    const launchColumns = db.prepare('PRAGMA table_info(session_launch_contexts)').all() as Array<{
      name: string;
    }>;
    const launchColumnNames = new Set(launchColumns.map((column) => column.name));

    assert.equal(launchColumnNames.has('project_repo_paths_json'), true);
    assert.equal(launchColumnNames.has('project_repo_relative_paths_json'), true);

    const indexes = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
        AND tbl_name = 'session_workspace_preparations'
    `).all() as Array<{ name: string }>;
    const indexNames = new Set(indexes.map((index) => index.name));

    assert.equal(indexNames.has('session_workspace_preparations_status_idx'), true);
    assert.equal(indexNames.has('session_workspace_preparations_expires_idx'), true);
    assert.equal(indexNames.has('session_workspace_preparations_fingerprint_idx'), true);
  });
});
