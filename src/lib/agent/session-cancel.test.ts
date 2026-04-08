import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { waitForCancelledSessionRunCleanup } from './session-cancel.ts';

describe('waitForCancelledSessionRunCleanup', () => {
  it('waits for the cleanup promise to finish before returning', async () => {
    let resolved = false;

    const cleanup = new Promise<void>((resolve) => {
      setTimeout(() => {
        resolved = true;
        resolve();
      }, 20);
    });

    await waitForCancelledSessionRunCleanup(cleanup);

    assert.equal(resolved, true);
  });

  it('swallows cleanup rejections from aborted runs', async () => {
    await assert.doesNotReject(async () => {
      await waitForCancelledSessionRunCleanup(Promise.reject(new Error('Request cancelled.')));
    });
  });
});
