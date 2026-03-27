import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    buildPreviewReloadUrl,
    PREVIEW_RELOAD_SEARCH_PARAM,
    resolvePreviewIframeUrl,
    shouldForcePreviewRemount,
    shouldForcePreviewRetryForTarget,
} from './session-preview.ts';

describe('shouldForcePreviewRemount', () => {
    it('returns true when retrying the same loaded preview URL', () => {
        assert.equal(
            shouldForcePreviewRemount('http://127.0.0.1:43123/', 'http://127.0.0.1:43123/'),
            true,
        );
    });

    it('returns false when there is no active preview or the target changes', () => {
        assert.equal(shouldForcePreviewRemount('', 'http://127.0.0.1:43123/'), false);
        assert.equal(
            shouldForcePreviewRemount('http://127.0.0.1:43123/', 'http://127.0.0.1:43123/other'),
            false,
        );
    });

    it('ignores the internal reload nonce when comparing retry URLs', () => {
        const reloadedPreviewUrl = buildPreviewReloadUrl('http://127.0.0.1:43123/', 123);
        assert.equal(
            shouldForcePreviewRemount(reloadedPreviewUrl, 'http://127.0.0.1:43123/'),
            true,
        );
    });
});

describe('buildPreviewReloadUrl', () => {
    it('adds or replaces the internal reload nonce without changing the base preview URL', () => {
        const firstReloadUrl = buildPreviewReloadUrl('http://127.0.0.1:43123/', 123);
        const secondReloadUrl = buildPreviewReloadUrl(firstReloadUrl, 456);

        const firstParsed = new URL(firstReloadUrl);
        const secondParsed = new URL(secondReloadUrl);

        assert.equal(firstParsed.origin, 'http://127.0.0.1:43123');
        assert.equal(firstParsed.pathname, '/');
        assert.equal(firstParsed.searchParams.get(PREVIEW_RELOAD_SEARCH_PARAM), '123');
        assert.equal(secondParsed.searchParams.get(PREVIEW_RELOAD_SEARCH_PARAM), '456');
    });
});

describe('shouldForcePreviewRetryForTarget', () => {
    it('returns true when retrying the same requested target URL', () => {
        assert.equal(
            shouldForcePreviewRetryForTarget('http://127.0.0.1:43123/', 'http://127.0.0.1:43123/'),
            true,
        );
    });

    it('returns false when there is no previous target or the target changes', () => {
        assert.equal(shouldForcePreviewRetryForTarget('', 'http://127.0.0.1:43123/'), false);
        assert.equal(
            shouldForcePreviewRetryForTarget('http://127.0.0.1:43123/', 'http://127.0.0.1:43123/other'),
            false,
        );
    });
});

describe('resolvePreviewIframeUrl', () => {
    it('forces a remount when retrying the same target after the iframe src was cleared', () => {
        const retryUrl = resolvePreviewIframeUrl({
            currentPreviewUrl: '',
            currentTargetUrl: 'http://127.0.0.1:43123/',
            nextPreviewUrl: 'http://127.0.0.1:9000/',
            nextTargetUrl: 'http://127.0.0.1:43123/',
            nonce: 789,
        });

        const parsed = new URL(retryUrl);
        assert.equal(parsed.origin, 'http://127.0.0.1:9000');
        assert.equal(parsed.searchParams.get(PREVIEW_RELOAD_SEARCH_PARAM), '789');
    });

    it('reuses the proxy URL when navigating to a different target', () => {
        assert.equal(
            resolvePreviewIframeUrl({
                currentPreviewUrl: 'http://127.0.0.1:9000/',
                currentTargetUrl: 'http://127.0.0.1:43123/',
                nextPreviewUrl: 'http://127.0.0.1:9000/other',
                nextTargetUrl: 'http://127.0.0.1:43123/other',
            }),
            'http://127.0.0.1:9000/other',
        );
    });
});
