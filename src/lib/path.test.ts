import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getBaseName } from './path.ts';

describe('getBaseName', () => {
  it('should return the filename from a path with POSIX separators', () => {
    assert.strictEqual(getBaseName('/path/to/file.txt'), 'file.txt');
  });

  it('should return the filename from a path with Windows separators', () => {
    assert.strictEqual(getBaseName('C:\\path\\to\\file.txt'), 'file.txt');
  });

  it('should return the last directory name if path ends with a separator', () => {
    assert.strictEqual(getBaseName('/path/to/dir/'), 'dir');
    assert.strictEqual(getBaseName('C:\\path\\to\\dir\\'), 'dir');
  });

  it('should return the filename if it is already just a filename', () => {
    assert.strictEqual(getBaseName('file.txt'), 'file.txt');
  });

  it('should handle mixed separators', () => {
    assert.strictEqual(getBaseName('path/to\\file.txt'), 'file.txt');
  });

  it('should return empty string for empty input', () => {
    assert.strictEqual(getBaseName(''), '');
  });

  it('should handle root paths (POSIX)', () => {
    assert.strictEqual(getBaseName('/'), '');
  });

  it('should handle root paths (Windows)', () => {
     // Current behavior returns 'C:' for 'C:\' or 'C:/'
     // This is because split returns ['C:', ''] and 'C:' is truthy
     assert.strictEqual(getBaseName('C:\\'), 'C:');
     assert.strictEqual(getBaseName('C:/'), 'C:');
  });

  it('should return "." or ".." if they are the path', () => {
    assert.strictEqual(getBaseName('.'), '.');
    assert.strictEqual(getBaseName('..'), '..');
  });

  it('should return empty string for null/undefined (runtime check)', () => {
    // @ts-expect-error Testing runtime behavior
    assert.strictEqual(getBaseName(null), '');
    // @ts-expect-error Testing runtime behavior
    assert.strictEqual(getBaseName(undefined), '');
  });
});
