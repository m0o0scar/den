import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { terminateSessionTerminalSessions } from './git.ts';

let tempDir = '';
let previousPath = '';
let statePath = '';

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'palx-git-action-test-'));
  statePath = path.join(tempDir, 'tmux-sessions.txt');
  previousPath = process.env.PATH || '';
  process.env.PATH = `${tempDir}:${previousPath}`;
  process.env.FAKE_TMUX_STATE = statePath;

  const scriptPath = path.join(tempDir, 'tmux');
  await writeFile(scriptPath, [
    '#!/bin/sh',
    'STATE_FILE="${FAKE_TMUX_STATE}"',
    'COMMAND="$1"',
    'if [ "$COMMAND" = "list-sessions" ]; then',
    '  if [ -f "$STATE_FILE" ]; then',
    '    cat "$STATE_FILE"',
    '  fi',
    '  exit 0',
    'fi',
    'if [ "$COMMAND" = "kill-session" ]; then',
    '  TARGET="$3"',
    '  if [ "${FAKE_TMUX_MODE}" = "linger" ]; then',
    '    exit 0',
    '  fi',
    '  if [ -f "$STATE_FILE" ]; then',
    '    grep -vx "$TARGET" "$STATE_FILE" > "$STATE_FILE.tmp" || true',
    '    mv "$STATE_FILE.tmp" "$STATE_FILE"',
    '  fi',
    '  exit 0',
    'fi',
    'exit 1',
    '',
  ].join('\n'), 'utf8');
  await chmod(scriptPath, 0o755);
});

after(async () => {
  process.env.PATH = previousPath;
  delete process.env.FAKE_TMUX_STATE;
  delete process.env.FAKE_TMUX_MODE;
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe('terminateSessionTerminalSessions', () => {
  it('reports lingering tmux sessions after kill attempts', async () => {
    process.env.FAKE_TMUX_MODE = 'linger';
    await writeFile(statePath, [
      'viba-session-1-agent',
      'viba-session-1-floating',
      'viba-other-session-agent',
      '',
    ].join('\n'), 'utf8');

    const result = await terminateSessionTerminalSessions('session-1');

    assert.equal(result.success, false);
    assert.deepEqual(result.terminatedSessions, ['viba-session-1-agent', 'viba-session-1-floating']);
    assert.deepEqual(result.lingeringSessions, ['viba-session-1-agent', 'viba-session-1-floating']);
    assert.match(result.error || '', /Failed to terminate tmux sessions/);
  });
});
