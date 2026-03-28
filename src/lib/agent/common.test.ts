import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { defaultSpawnEnv, prepareSpawnCommand, resolveExecutable } from './common.ts';

describe('defaultSpawnEnv', () => {
  it('merges extra env without dropping PATH handling', () => {
    const env = defaultSpawnEnv({
      GITHUB_TOKEN: 'ghu_test',
      GITLAB_HOST: 'gitlab.corp.example',
    });

    assert.strictEqual(env['GITHUB_TOKEN'], 'ghu_test');
    assert.strictEqual(env['GITLAB_HOST'], 'gitlab.corp.example');
    assert.ok(typeof env.PATH === 'string' && env.PATH.length > 0);
    assert.match(env.PATH, new RegExp(path.join(os.homedir(), '.local', 'bin').replace(/\\/g, '\\\\')));
  });
});

describe('resolveExecutable', () => {
  it('prefers a Windows .cmd shim when present on PATH', () => {
    const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viba-agent-common-test-bin-'));
    const env = { PATH: fakeBinDir } as NodeJS.ProcessEnv;

    try {
      fs.writeFileSync(path.join(fakeBinDir, 'codex.cmd'), '', 'utf8');
      const resolved = resolveExecutable(['codex', 'codex.cmd'], env);
      assert.strictEqual(resolved.toLowerCase(), path.join(fakeBinDir, 'codex.cmd').toLowerCase());
    } finally {
      fs.rmSync(fakeBinDir, { recursive: true, force: true });
    }
  });
});

describe('prepareSpawnCommand', () => {
  it('wraps Windows command shims with cmd.exe', () => {
    if (process.platform !== 'win32') {
      return;
    }

    const prepared = prepareSpawnCommand(
      'C:\\tools\\codex.cmd',
      ['exec', '--output', 'C:\\Program Files\\Palx\\last-message.txt'],
      { ComSpec: 'C:\\Windows\\System32\\cmd.exe' } as NodeJS.ProcessEnv,
    );

    assert.strictEqual(prepared.command, 'C:\\Windows\\System32\\cmd.exe');
    assert.deepStrictEqual(prepared.args, [
      '/d',
      '/s',
      '/c',
      'C:\\tools\\codex.cmd exec --output "C:\\Program Files\\Palx\\last-message.txt"',
    ]);
    assert.strictEqual(prepared.windowsVerbatimArguments, true);
  });
});
