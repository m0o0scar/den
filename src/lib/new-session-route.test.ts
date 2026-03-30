import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type NewSessionRouteModule = typeof import('./new-session-route.ts');
type StoreModule = typeof import('./store.ts');

let tempHome = '';
let previousHome = '';
let previousUserProfile = '';
let newSessionRouteModule: NewSessionRouteModule;
let storeModule: StoreModule;

before(async () => {
  tempHome = await mkdtemp(path.join(os.tmpdir(), 'palx-new-session-route-test-'));
  previousHome = process.env.HOME || '';
  previousUserProfile = process.env.USERPROFILE || '';
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  newSessionRouteModule = await import('./new-session-route.ts');
  storeModule = await import('./store.ts');
});

after(async () => {
  process.env.HOME = previousHome;
  process.env.USERPROFILE = previousUserProfile;
  if (tempHome) {
    await rm(tempHome, { recursive: true, force: true });
  }
});

describe('new session route canonicalization', () => {
  it('keeps projectId params canonical and resolves legacy project paths to the same id', () => {
    const project = storeModule.addProject({
      name: 'Route Canonicalization',
      folderPaths: [
        path.join(tempHome, 'palx-new-session-route-project'),
        path.join(tempHome, 'palx-new-session-route-alt'),
      ],
    });

    assert.equal(newSessionRouteModule.resolveNewSessionProjectReference(project.id), project.id);
    assert.equal(newSessionRouteModule.resolveNewSessionProjectReference(project.folderPaths[0]), project.id);
    assert.equal(newSessionRouteModule.resolveNewSessionProjectReference(project.folderPaths[1]), project.id);
  });
});
