import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGENT_SESSION_CODE_BLOCK_CLASSNAME,
  AGENT_SESSION_PANE_CLASSNAME,
  AGENT_SESSION_TIMELINE_CLASSNAME,
} from './agent-session-pane-styles.ts';

test('agent session pane preserves a shrinkable flex column shell', () => {
  assert.match(AGENT_SESSION_PANE_CLASSNAME, /\bflex\b/);
  assert.match(AGENT_SESSION_PANE_CLASSNAME, /\bh-full\b/);
  assert.match(AGENT_SESSION_PANE_CLASSNAME, /\bmin-h-0\b/);
  assert.match(AGENT_SESSION_PANE_CLASSNAME, /\bflex-col\b/);
});

test('agent session timeline can shrink and scroll within the pane', () => {
  assert.match(AGENT_SESSION_TIMELINE_CLASSNAME, /\bmin-h-0\b/);
  assert.match(AGENT_SESSION_TIMELINE_CLASSNAME, /\bflex-1\b/);
  assert.match(AGENT_SESSION_TIMELINE_CLASSNAME, /\boverflow-y-auto\b/);
});

test('agent session code blocks keep readable light and dark theme colors', () => {
  assert.match(AGENT_SESSION_CODE_BLOCK_CLASSNAME, /\bbg-slate-100\b/);
  assert.match(AGENT_SESSION_CODE_BLOCK_CLASSNAME, /\btext-slate-800\b/);
  assert.match(AGENT_SESSION_CODE_BLOCK_CLASSNAME, /\bdark:text-slate-100\b/);
  assert.match(AGENT_SESSION_CODE_BLOCK_CLASSNAME, /\bapp-dark-code\b/);
});
