import assert from 'node:assert';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { runInBackground } from './background-task.ts';

test('runInBackground defers execution until after the current turn', async () => {
  const events: string[] = [];

  runInBackground(() => {
    events.push('task');
  });

  events.push('after-schedule');
  assert.deepStrictEqual(events, ['after-schedule']);

  await delay(0);

  assert.deepStrictEqual(events, ['after-schedule', 'task']);
});

test('runInBackground forwards async rejections to the error handler', async () => {
  await new Promise<void>((resolve, reject) => {
    runInBackground(
      async () => {
        throw new Error('async failure');
      },
      (error) => {
        try {
          assert.ok(error instanceof Error);
          assert.strictEqual(error.message, 'async failure');
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      },
    );
  });
});

test('runInBackground forwards sync throws to the error handler', async () => {
  await new Promise<void>((resolve, reject) => {
    runInBackground(
      () => {
        throw new Error('sync failure');
      },
      (error) => {
        try {
          assert.ok(error instanceof Error);
          assert.strictEqual(error.message, 'sync failure');
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      },
    );
  });
});
