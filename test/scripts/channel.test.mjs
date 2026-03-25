import assert from "node:assert";
import { describe, it } from "node:test";

import { extractProviderUrl, formatAuth0Help } from "../../scripts/channel.mjs";

describe("extractProviderUrl", () => {
  it("extracts the nport public origin from output", () => {
    const text = "Tunnel ready at https://palx.nport.link -> http://127.0.0.1:3200";
    assert.strictEqual(extractProviderUrl(text, "nport"), "https://palx.nport.link");
  });

  it("extracts the ngrok public origin from output", () => {
    const text = "Forwarding https://abc123.ngrok-free.app -> http://localhost:3200";
    assert.strictEqual(extractProviderUrl(text, "ngrok"), "https://abc123.ngrok-free.app");
  });

  it("ignores unrelated urls", () => {
    const text = "Listening on http://localhost:3200";
    assert.strictEqual(extractProviderUrl(text, "nport"), null);
    assert.strictEqual(extractProviderUrl(text, "ngrok"), null);
  });
});

describe("formatAuth0Help", () => {
  it("prints exact callback, logout, and app base url values", () => {
    const help = formatAuth0Help("https://palx.nport.link");

    assert.match(help, /https:\/\/palx\.nport\.link\/auth\/callback/);
    assert.match(help, /Auth0 Allowed Logout URLs:\n- https:\/\/palx\.nport\.link/);
    assert.match(help, /APP_BASE_URL entry:\n- http:\/\/localhost:3200,https:\/\/palx\.nport\.link/);
  });
});
