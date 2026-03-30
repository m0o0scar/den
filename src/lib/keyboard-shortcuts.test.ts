import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isWindowsPlatform,
  isPrimaryShortcutModifierPressed,
  platformUsesMetaShortcuts,
} from './keyboard-shortcuts.ts';

describe('platformUsesMetaShortcuts', () => {
  it('uses meta shortcuts on macOS', () => {
    assert.equal(platformUsesMetaShortcuts('MacIntel'), true);
    assert.equal(platformUsesMetaShortcuts('macOS'), true);
  });

  it('uses ctrl shortcuts on Windows and Linux', () => {
    assert.equal(platformUsesMetaShortcuts('Win32'), false);
    assert.equal(platformUsesMetaShortcuts('Linux x86_64'), false);
    assert.equal(platformUsesMetaShortcuts(undefined), false);
  });
});

describe('isPrimaryShortcutModifierPressed', () => {
  it('checks meta on macOS', () => {
    assert.equal(
      isPrimaryShortcutModifierPressed({ metaKey: true, ctrlKey: false }, 'MacIntel'),
      true,
    );
    assert.equal(
      isPrimaryShortcutModifierPressed({ metaKey: false, ctrlKey: true }, 'MacIntel'),
      false,
    );
  });

  it('checks ctrl on non-mac platforms', () => {
    assert.equal(
      isPrimaryShortcutModifierPressed({ metaKey: false, ctrlKey: true }, 'Win32'),
      true,
    );
    assert.equal(
      isPrimaryShortcutModifierPressed({ metaKey: true, ctrlKey: false }, 'Win32'),
      false,
    );
  });
});

describe('isWindowsPlatform', () => {
  it('detects Windows browser platforms', () => {
    assert.equal(isWindowsPlatform('Win32'), true);
    assert.equal(isWindowsPlatform('Windows'), true);
  });

  it('does not treat macOS or Linux as Windows', () => {
    assert.equal(isWindowsPlatform('MacIntel'), false);
    assert.equal(isWindowsPlatform('Linux x86_64'), false);
    assert.equal(isWindowsPlatform(undefined), false);
  });
});
