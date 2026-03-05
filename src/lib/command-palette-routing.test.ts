import { describe, test } from 'node:test';
import assert from 'node:assert';
import { buildCommandPaletteRepoNavigation } from './command-palette-routing.ts';

describe('buildCommandPaletteRepoNavigation', () => {
  test('opens /new from home page', () => {
    const navigation = buildCommandPaletteRepoNavigation({
      pathname: '/',
      repoPath: '/tmp/my-repo',
    });

    assert.deepStrictEqual(navigation, {
      method: 'push',
      href: '/new?repo=%2Ftmp%2Fmy-repo',
    });
  });

  test('opens /new from session page', () => {
    const navigation = buildCommandPaletteRepoNavigation({
      pathname: '/session/abc-123',
      repoPath: '/tmp/my-repo',
    });

    assert.deepStrictEqual(navigation, {
      method: 'push',
      href: '/new?repo=%2Ftmp%2Fmy-repo',
    });
  });

  test('replaces repo query when already on /new while preserving other params', () => {
    const navigation = buildCommandPaletteRepoNavigation({
      pathname: '/new',
      search: 'from=demo-session&prefillFromSession=abc',
      repoPath: '/tmp/my-repo',
    });

    assert.deepStrictEqual(navigation, {
      method: 'replace',
      href: '/new?from=demo-session&prefillFromSession=abc&repo=%2Ftmp%2Fmy-repo',
    });
  });

  test('opens /git with path when on git pages', () => {
    const navigation = buildCommandPaletteRepoNavigation({
      pathname: '/git/history',
      repoPath: '/tmp/my-repo',
    });

    assert.deepStrictEqual(navigation, {
      method: 'push',
      href: '/git?path=%2Ftmp%2Fmy-repo',
    });
  });
});
