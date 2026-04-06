import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { SessionAgentHistoryInput } from '../../lib/types.ts';
import type { SessionMetadata } from './session.ts';

type SessionActionsModule = typeof import('./session.ts');
type LocalDbModule = typeof import('../../lib/local-db.ts');
type HotStoreModule = typeof import('../../lib/agent/session-hot-store.ts');

let tempHome = '';
let previousHome = '';
let previousUserProfile = '';
let sessionActions: SessionActionsModule;
let localDbModule: LocalDbModule;
let hotStoreModule: HotStoreModule;

before(async () => {
  tempHome = await mkdtemp(path.join(os.tmpdir(), 'den-session-snapshot-test-'));
  previousHome = process.env.HOME || '';
  previousUserProfile = process.env.USERPROFILE || '';
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  localDbModule = await import('../../lib/local-db.ts');
  hotStoreModule = await import('../../lib/agent/session-hot-store.ts');
  sessionActions = await import('./session.ts');
});

beforeEach(async () => {
  hotStoreModule.resetSessionHotStoreForTests();
  localDbModule.resetLocalStateForTests();
  await rm(path.join(tempHome, '.viba'), { recursive: true, force: true });
});

after(async () => {
  process.env.HOME = previousHome;
  process.env.USERPROFILE = previousUserProfile;
  hotStoreModule.resetSessionHotStoreForTests();
  localDbModule.resetLocalStateForTests();
  if (tempHome) {
    await rm(tempHome, { recursive: true, force: true });
  }
});

function createSessionMetadata(): SessionMetadata {
  return {
    sessionName: 'session-1',
    projectId: 'project-1',
    projectPath: '/tmp/project',
    workspacePath: '/tmp/project/workspace',
    workspaceFolders: [],
    workspaceMode: 'folder',
    activeRepoPath: '/tmp/project',
    gitRepos: [{
      sourceRepoPath: '/tmp/project',
      relativeRepoPath: '',
      worktreePath: '/tmp/project/workspace',
      branchName: 'main',
      baseBranch: 'main',
    }],
    agent: 'codex',
    agentProvider: 'codex',
    model: 'gpt-5.4',
    reasoningEffort: 'medium',
    timestamp: '2026-04-06T09:59:00.000Z',
  };
}

describe('session agent snapshots', () => {
  it('keeps runtime in the hot store while paging history from newest to oldest', async () => {
    await sessionActions.saveSessionMetadata(createSessionMetadata());
    const runtimeUpdate = await sessionActions.updateSessionAgentRuntimeState('session-1', {
      threadId: 'thread-1',
      runState: 'running',
      lastActivityAt: '2026-04-06T10:00:00.000Z',
    });

    assert.equal(runtimeUpdate.success, true);
    assert.equal(localDbModule.readLocalState().sessions['session-1']?.threadId ?? null, null);

    const history: SessionAgentHistoryInput[] = Array.from({ length: 550 }, (_, index) => {
      const createdAt = `2026-04-06T10:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`;
      if (index % 2 === 0) {
        return {
          kind: 'user',
          id: `item-${index}`,
          text: `message ${index}`,
          ordinal: index,
          createdAt,
          updatedAt: createdAt,
        };
      }

      return {
        kind: 'assistant',
        id: `item-${index}`,
        text: `message ${index}`,
        phase: null,
        ordinal: index,
        createdAt,
        updatedAt: createdAt,
      };
    });
    const replaceResult = await sessionActions.replaceSessionAgentHistory('session-1', history);
    assert.equal(replaceResult.success, true);
    assert.equal(localDbModule.readLocalState().sessionAgentHistoryItems['session-1'], undefined);

    const snapshot = await sessionActions.getSessionAgentSnapshot('session-1');
    assert.equal(snapshot.success, true);
    assert.equal(snapshot.snapshot?.runtime.threadId, 'thread-1');
    assert.equal(snapshot.snapshot?.history.length, 300);
    assert.equal(snapshot.snapshot?.historyPage.oldestLoadedOrdinal, 250);
    assert.equal(snapshot.snapshot?.historyPage.hasOlder, true);
    assert.equal(snapshot.snapshot?.history[0]?.id, 'item-250');
    assert.equal(snapshot.snapshot?.history.at(-1)?.id, 'item-549');

    const olderPage = await sessionActions.getSessionAgentSnapshot('session-1', {
      limit: 200,
      beforeOrdinal: snapshot.snapshot?.historyPage.oldestLoadedOrdinal ?? undefined,
    });
    assert.equal(olderPage.success, true);
    assert.equal(olderPage.snapshot?.history.length, 200);
    assert.equal(olderPage.snapshot?.historyPage.oldestLoadedOrdinal, 50);
    assert.equal(olderPage.snapshot?.historyPage.hasOlder, true);
    assert.equal(olderPage.snapshot?.history[0]?.id, 'item-50');
    assert.equal(olderPage.snapshot?.history.at(-1)?.id, 'item-249');

    const oldestPage = await sessionActions.getSessionAgentSnapshot('session-1', {
      limit: 200,
      beforeOrdinal: olderPage.snapshot?.historyPage.oldestLoadedOrdinal ?? undefined,
    });
    assert.equal(oldestPage.success, true);
    assert.equal(oldestPage.snapshot?.history.length, 50);
    assert.equal(oldestPage.snapshot?.historyPage.oldestLoadedOrdinal, 0);
    assert.equal(oldestPage.snapshot?.historyPage.hasOlder, false);

    const metadata = await sessionActions.getSessionMetadata('session-1');
    assert.equal(metadata?.threadId, 'thread-1');
    assert.equal(metadata?.runState, 'running');
  });

  it('keeps hot runtime provider settings in sync with metadata updates', async () => {
    await sessionActions.saveSessionMetadata(createSessionMetadata());

    const updatedMetadata: SessionMetadata = {
      ...createSessionMetadata(),
      agent: 'gemini',
      agentProvider: 'gemini',
      model: 'gemini-2.5-pro',
      reasoningEffort: 'low',
    };
    await sessionActions.saveSessionMetadata(updatedMetadata);

    const runtime = await sessionActions.getSessionAgentRuntimeState('session-1');
    assert.equal(runtime?.agentProvider, 'gemini');
    assert.equal(runtime?.model, 'gemini-2.5-pro');
    assert.equal(runtime?.reasoningEffort, 'low');

    const snapshot = await sessionActions.getSessionAgentSnapshot('session-1');
    assert.equal(snapshot.success, true);
    assert.equal(snapshot.snapshot?.runtime.agentProvider, 'gemini');
    assert.equal(snapshot.snapshot?.runtime.model, 'gemini-2.5-pro');
  });
});
