import assert from "node:assert/strict";
import test from "node:test";
import { resolveNextArgs } from "../../scripts/run-next-with-server-actions-key.mjs";

test("resolveNextArgs allocates the next available port for dev when none is explicit", async () => {
  let received = null;

  const result = await resolveNextArgs(
    ["dev"],
    {},
    {
      resolveStartupPortImpl: async (options) => {
        received = options;
        return { preferredPort: 3200, port: 3204 };
      },
    },
  );

  assert.deepEqual(received, { env: {}, port: undefined, portExplicit: false });
  assert.deepEqual(result, {
    preferredPort: 3200,
    port: 3204,
    nextArgs: ["dev", "--port", "3204"],
  });
});

test("resolveNextArgs preserves an explicit port for dev", async () => {
  let received = null;

  const result = await resolveNextArgs(
    ["dev", "--hostname", "127.0.0.1", "--port", "3300"],
    {},
    {
      resolveStartupPortImpl: async (options) => {
        received = options;
        return { preferredPort: 3300, port: 3300 };
      },
    },
  );

  assert.deepEqual(received, { env: {}, port: 3300, portExplicit: true });
  assert.deepEqual(result, {
    preferredPort: 3300,
    port: 3300,
    nextArgs: ["dev", "--hostname", "127.0.0.1", "--port", "3300"],
  });
});

test("resolveNextArgs leaves non-server commands unchanged", async () => {
  const result = await resolveNextArgs(["build", "--webpack"], {});
  assert.deepEqual(result, {
    nextArgs: ["build", "--webpack"],
  });
});
