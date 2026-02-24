import { test, describe } from 'node:test';
import assert from 'node:assert';
import { escapeRegex, toKebabCase, toPascalCase, uniqueStrings } from './string-utils.ts';

describe('string-utils', () => {
  test('escapeRegex should escape special regex characters', () => {
    assert.strictEqual(escapeRegex('foo'), 'foo');
    assert.strictEqual(escapeRegex('foo.bar'), 'foo\\.bar');
    assert.strictEqual(escapeRegex('foo[bar]'), 'foo\\[bar\\]');
    assert.strictEqual(escapeRegex('foo$bar'), 'foo\\$bar');
    assert.strictEqual(escapeRegex('foo^bar'), 'foo\\^bar');
    assert.strictEqual(escapeRegex('foo(bar)'), 'foo\\(bar\\)');
    assert.strictEqual(escapeRegex('foo|bar'), 'foo\\|bar');
    assert.strictEqual(escapeRegex('foo?bar'), 'foo\\?bar');
    assert.strictEqual(escapeRegex('foo*bar'), 'foo\\*bar');
    assert.strictEqual(escapeRegex('foo+bar'), 'foo\\+bar');
  });

  test('toKebabCase should convert camelCase and PascalCase to kebab-case', () => {
    assert.strictEqual(toKebabCase('fooBar'), 'foo-bar');
    assert.strictEqual(toKebabCase('FooBar'), 'foo-bar');
    assert.strictEqual(toKebabCase('foo_bar'), 'foo-bar');
    assert.strictEqual(toKebabCase('foo bar'), 'foo-bar');
    assert.strictEqual(toKebabCase('fooBarBaz'), 'foo-bar-baz');
    assert.strictEqual(toKebabCase('foo123Bar'), 'foo123-bar');
    assert.strictEqual(toKebabCase('FOO_BAR'), 'foo-bar');
  });

  test('toPascalCase should convert various cases to PascalCase', () => {
    assert.strictEqual(toPascalCase('foo-bar'), 'FooBar');
    assert.strictEqual(toPascalCase('foo_bar'), 'FooBar');
    assert.strictEqual(toPascalCase('foo bar'), 'FooBar');
    assert.strictEqual(toPascalCase('fooBar'), 'FooBar');
    assert.strictEqual(toPascalCase('foo--bar'), 'FooBar');
  });

  test('uniqueStrings should return unique strings from array', () => {
    assert.deepStrictEqual(uniqueStrings(['a', 'b', 'c']), ['a', 'b', 'c']);
    assert.deepStrictEqual(uniqueStrings(['a', 'b', 'a']), ['a', 'b']);
    assert.deepStrictEqual(uniqueStrings([]), []);
  });
});
