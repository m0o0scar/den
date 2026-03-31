import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type LocalDbModule = typeof import('./local-db.ts');

let tempHome = '';
let previousHome = '';
let previousUserProfile = '';
let localDbModule: LocalDbModule;

before(async () => {
  tempHome = await mkdtemp(path.join(os.tmpdir(), 'palx-local-state-test-'));
  previousHome = process.env.HOME || '';
  previousUserProfile = process.env.USERPROFILE || '';
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  localDbModule = await import('./local-db.ts');
});

beforeEach(() => {
  localDbModule.resetLocalStateForTests();
});

after(async () => {
  process.env.HOME = previousHome;
  process.env.USERPROFILE = previousUserProfile;
  if (tempHome) {
    await rm(tempHome, { recursive: true, force: true });
  }
});

describe('local state persistence', () => {
  it('uses a JSON state file under ~/.viba', () => {
    assert.equal(
      localDbModule.getLocalDbPath(),
      path.join(tempHome, '.viba', 'palx-state.json'),
    );
  });

  it('initializes the expected top-level collections', () => {
    const state = localDbModule.readLocalState();

    assert.deepEqual(Object.keys(state.projects), []);
    assert.deepEqual(Object.keys(state.sessions), []);
    assert.deepEqual(Object.keys(state.sessionCanvasLayouts), []);
    assert.deepEqual(Object.keys(state.sessionWorkspacePreparations), []);
    assert.deepEqual(Object.keys(state.quickCreateDrafts), []);
    assert.equal(state.appConfig.selectedIde, 'vscode');
  });

  it('persists updates atomically through the JSON state file', async () => {
    localDbModule.updateLocalState((state) => {
      state.sessionCanvasLayouts['session-1'] = {
        sessionName: 'session-1',
        layoutJson: '{"version":1}',
        updatedAt: '2026-03-30T07:00:00.000Z',
      };
      state.sessionWorkspacePreparations['prep-1'] = {
        preparationId: 'prep-1',
        projectId: 'project-1',
        projectPath: '/tmp/project',
        contextFingerprint: 'fingerprint',
        sessionName: 'session-1',
        payloadJson: '{"workspacePath":"/tmp/project"}',
        status: 'ready',
        cancelRequested: false,
        createdAt: '2026-03-30T07:00:00.000Z',
        updatedAt: '2026-03-30T07:00:00.000Z',
        expiresAt: '2026-03-30T08:00:00.000Z',
        consumedAt: null,
        releasedAt: null,
      };
    });

    localDbModule.resetLocalStateForTests();
    const reloadedState = localDbModule.readLocalState();
    const rawFile = JSON.parse(await readFile(localDbModule.getLocalDbPath(), 'utf8')) as {
      sessionCanvasLayouts: Record<string, { layoutJson: string }>;
      sessionWorkspacePreparations: Record<string, { status: string }>;
    };

    assert.equal(reloadedState.sessionCanvasLayouts['session-1']?.layoutJson, '{"version":1}');
    assert.equal(reloadedState.sessionWorkspacePreparations['prep-1']?.status, 'ready');
    assert.equal(rawFile.sessionCanvasLayouts['session-1']?.layoutJson, '{"version":1}');
    assert.equal(rawFile.sessionWorkspacePreparations['prep-1']?.status, 'ready');
  });

  it('reloads external writes before applying updates', async () => {
    void localDbModule.readLocalState();

    await writeFile(localDbModule.getLocalDbPath(), JSON.stringify({
      version: 1,
      projects: {
        'project-1': {
          id: 'project-1',
          name: 'Project 1',
          folderPaths: ['/tmp/project-1'],
        },
      },
      repositories: {},
      appSettings: {},
      appConfig: {
        recentProjects: [],
        homeProjectSort: 'last-update',
        defaultRoot: '',
        selectedIde: 'vscode',
        agentWidth: 66.666,
        pinnedFolderShortcuts: [],
        projectSettings: {},
      },
      gitRepoCredentials: {},
      credentialsMetadata: [],
      agentApiCredentialsMetadata: [],
      sessions: {},
      sessionLaunchContexts: {},
      sessionCanvasLayouts: {},
      sessionWorkspacePreparations: {},
      drafts: {},
      quickCreateDrafts: {},
      sessionAgentHistoryItems: {},
    }, null, 2), 'utf8');

    localDbModule.updateLocalState((state) => {
      state.appConfig.recentProjects = ['project-1'];
    });

    const reloadedState = localDbModule.readLocalState();
    assert.equal(reloadedState.projects['project-1']?.name, 'Project 1');
    assert.deepEqual(reloadedState.appConfig.recentProjects, ['project-1']);
  });
});
