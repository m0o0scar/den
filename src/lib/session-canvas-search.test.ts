import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { searchSessionCanvasWorkspaceEntries } from './session-canvas-search.ts';

const tempRoots: string[] = [];

after(async () => {
  await Promise.all(
    tempRoots.map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })),
  );
});

async function createWorkspaceRoot(prefix: string): Promise<string> {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(workspaceRoot);
  return workspaceRoot;
}

describe('searchSessionCanvasWorkspaceEntries', () => {
  it('finds path matches by basename and nested relative path', async () => {
    const workspaceRoot = await createWorkspaceRoot('palx-session-search-path-');
    await fs.mkdir(path.join(workspaceRoot, 'src', 'components'), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, 'src', 'components', 'ButtonPalette.tsx'), 'export const Button = null;\n');

    const results = await searchSessionCanvasWorkspaceEntries(workspaceRoot, 'palette');

    assert.equal(results.length, 1);
    assert.equal(results[0]?.relativePath, 'src/components/ButtonPalette.tsx');
    assert.deepEqual(results[0]?.matchKinds, ['path']);
  });

  it('finds content matches with a snippet', async () => {
    const workspaceRoot = await createWorkspaceRoot('palx-session-search-content-');
    await fs.mkdir(path.join(workspaceRoot, 'docs'), { recursive: true });
    await fs.writeFile(
      path.join(workspaceRoot, 'docs', 'guide.md'),
      'Use the command palette to find files quickly.\nThis line should be searchable.\n',
    );

    const results = await searchSessionCanvasWorkspaceEntries(workspaceRoot, 'searchable');

    assert.equal(results.length, 1);
    assert.equal(results[0]?.relativePath, 'docs/guide.md');
    assert.deepEqual(results[0]?.matchKinds, ['content']);
    assert.match(results[0]?.snippet ?? '', /searchable/i);
  });

  it('deduplicates files that match both path and content', async () => {
    const workspaceRoot = await createWorkspaceRoot('palx-session-search-both-');
    await fs.writeFile(
      path.join(workspaceRoot, 'palette-notes.md'),
      'This palette note also mentions the palette in content.\n',
    );

    const results = await searchSessionCanvasWorkspaceEntries(workspaceRoot, 'palette');

    assert.equal(results.length, 1);
    assert.deepEqual(results[0]?.matchKinds, ['path', 'content']);
  });

  it('skips ignored directories', async () => {
    const workspaceRoot = await createWorkspaceRoot('palx-session-search-ignore-');
    await fs.mkdir(path.join(workspaceRoot, 'node_modules', 'pkg'), { recursive: true });
    await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, 'node_modules', 'pkg', 'ignored.md'), 'palette should not be found here\n');
    await fs.writeFile(path.join(workspaceRoot, 'src', 'visible.md'), 'palette should be found here\n');

    const results = await searchSessionCanvasWorkspaceEntries(workspaceRoot, 'palette');

    assert.equal(results.length, 1);
    assert.equal(results[0]?.relativePath, 'src/visible.md');
  });

  it('skips content search for binary and oversized files', async () => {
    const workspaceRoot = await createWorkspaceRoot('palx-session-search-binary-');
    await fs.writeFile(path.join(workspaceRoot, 'image.png'), Buffer.from([0, 159, 146, 150]));
    await fs.writeFile(path.join(workspaceRoot, 'large.txt'), `header\n${'a'.repeat(270 * 1024)}needle\n`);
    await fs.writeFile(path.join(workspaceRoot, 'small.txt'), 'needle in a text file\n');

    const results = await searchSessionCanvasWorkspaceEntries(workspaceRoot, 'needle');

    assert.equal(results.length, 1);
    assert.equal(results[0]?.relativePath, 'small.txt');
  });

  it('ranks strong path matches ahead of content-only matches', async () => {
    const workspaceRoot = await createWorkspaceRoot('palx-session-search-rank-');
    await fs.mkdir(path.join(workspaceRoot, 'notes'), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, 'palette-overview.md'), 'overview\n');
    await fs.writeFile(path.join(workspaceRoot, 'notes', 'misc.md'), 'the palette appears only in content\n');

    const results = await searchSessionCanvasWorkspaceEntries(workspaceRoot, 'palette');

    assert.equal(results.length, 2);
    assert.equal(results[0]?.relativePath, 'palette-overview.md');
    assert.equal(results[1]?.relativePath, 'notes/misc.md');
    assert.deepEqual(results[1]?.matchKinds, ['content']);
  });
});
