import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countActiveHomeProjectSessionsByProject,
  isActiveHomeProjectSession,
} from './home-project-activity.ts';

describe('home project activity', () => {
  it('treats non-terminal and legacy sessions as active', () => {
    assert.equal(isActiveHomeProjectSession(undefined), true);
    assert.equal(isActiveHomeProjectSession(null), true);
    assert.equal(isActiveHomeProjectSession('queued'), true);
    assert.equal(isActiveHomeProjectSession('running'), true);
    assert.equal(isActiveHomeProjectSession('needs_auth'), true);
    assert.equal(isActiveHomeProjectSession('completed'), false);
    assert.equal(isActiveHomeProjectSession('cancelled'), false);
    assert.equal(isActiveHomeProjectSession('error'), false);
  });

  it('counts active sessions by resolved project key', () => {
    const counts = countActiveHomeProjectSessionsByProject(
      [
        { projectId: 'project-1', projectPath: '/tmp/project-1', runState: 'running' },
        { projectPath: '/tmp/project-1', runState: 'queued' },
        { repoPath: '/tmp/project-2', runState: 'needs_auth' },
        { projectId: 'project-1', runState: 'completed' },
        { projectId: 'project-2', runState: 'error' },
        { projectPath: '/tmp/project-3' },
        { projectPath: '/tmp/project-4', runState: 'cancelled' },
      ],
      (session) => session.projectId || session.projectPath || session.repoPath || '',
    );

    assert.equal(counts.get('project-1'), 1);
    assert.equal(counts.get('/tmp/project-1'), 1);
    assert.equal(counts.get('/tmp/project-2'), 1);
    assert.equal(counts.get('/tmp/project-3'), 1);
    assert.equal(counts.has('project-2'), false);
    assert.equal(counts.has('/tmp/project-4'), false);
  });
});
