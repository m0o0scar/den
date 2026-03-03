import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import { createKeytarLoader, type KeytarModule } from './keytar-loader.ts';

describe('createKeytarLoader', () => {
  it('caches loaded keytar module', async () => {
    let loadCount = 0;
    const keytarModule: KeytarModule = {
      getPassword: async () => null,
      setPassword: async () => undefined,
      deletePassword: async () => true,
    };

    const loader = createKeytarLoader({
      logLabel: 'test',
      loadModule: async () => {
        loadCount += 1;
        return keytarModule;
      },
    });

    const first = await loader.loadKeytar();
    const second = await loader.loadKeytar();

    assert.strictEqual(first, keytarModule);
    assert.strictEqual(second, keytarModule);
    assert.strictEqual(loadCount, 1);
  });

  it('logs once and returns unavailable error when loading fails', async () => {
    let loadCount = 0;
    const warnMessages: string[] = [];
    const warnMock = mock.method(console, 'warn', (message: string) => {
      warnMessages.push(message);
    });

    try {
      const loader = createKeytarLoader({
        logLabel: 'test-loader',
        loadModule: async () => {
          loadCount += 1;
          throw new Error('boom');
        },
      });

      const first = await loader.loadKeytar();
      const second = await loader.loadKeytar();

      assert.strictEqual(first, null);
      assert.strictEqual(second, null);
      assert.strictEqual(loadCount, 1);
      assert.strictEqual(warnMessages.length, 1);
      assert.strictEqual(
        warnMessages[0],
        '[test-loader] Secure credential storage is unavailable: boom',
      );

      await assert.rejects(
        loader.requireKeytar(),
        /Secure credential storage is unavailable: boom/,
      );
    } finally {
      warnMock.mock.restore();
    }
  });
});
