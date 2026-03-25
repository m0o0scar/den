#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";

const PROVIDERS = {
  nport: {
    command: "npx",
    args: ["nport", "3200", "-s", "palx"],
    hostPattern: /^https:\/\/[a-z0-9.-]+\.nport\.link$/i,
  },
  ngrok: {
    command: "npx",
    args: ["ngrok", "http", "3200"],
    hostPattern: /^https:\/\/[a-z0-9.-]+\.ngrok(?:-free\.app|\.app|\.io)$/i,
  },
};

function normalizeUrl(rawUrl) {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

export function extractProviderUrl(text, provider) {
  if (!text) {
    return null;
  }

  const config = PROVIDERS[provider];
  if (!config) {
    return null;
  }

  const matches = text.match(/https?:\/\/[^\s"'`<>)\]]+/gi) ?? [];
  for (const match of matches) {
    const normalized = normalizeUrl(match);
    if (normalized && config.hostPattern.test(normalized)) {
      return normalized;
    }
  }

  return null;
}

export function formatAuth0Help(origin) {
  const callbackUrl = `${origin}/auth/callback`;
  return [
    "",
    "Palx channel detected",
    `Public URL: ${origin}`,
    "Auth0 Allowed Callback URLs:",
    `- ${callbackUrl}`,
    "Auth0 Allowed Logout URLs:",
    `- ${origin}`,
    "APP_BASE_URL entry:",
    `- http://localhost:3200,${origin}`,
    "",
  ].join("\n");
}

async function tryFetchNgrokTunnelUrl() {
  try {
    const response = await fetch("http://127.0.0.1:4040/api/tunnels");
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const tunnels = Array.isArray(data?.tunnels) ? data.tunnels : [];
    for (const tunnel of tunnels) {
      const origin = normalizeUrl(tunnel?.public_url);
      if (origin && PROVIDERS.ngrok.hostPattern.test(origin)) {
        return origin;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function main() {
  const provider = process.argv[2];
  const config = PROVIDERS[provider];

  if (!config) {
    console.error("Usage: node ./scripts/channel.mjs <nport|ngrok>");
    process.exit(1);
  }

  let announcedOrigin = null;
  let ngrokProbeTimer = null;

  const maybeAnnounceOrigin = (origin) => {
    if (!origin || origin === announcedOrigin) {
      return;
    }

    announcedOrigin = origin;
    process.stdout.write(formatAuth0Help(origin));
  };

  const child = spawn(config.command, config.args, {
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });

  const handleChunk = (chunk, writer) => {
    const text = chunk.toString();
    writer.write(text);
    maybeAnnounceOrigin(extractProviderUrl(text, provider));
  };

  child.stdout?.on("data", (chunk) => handleChunk(chunk, process.stdout));
  child.stderr?.on("data", (chunk) => handleChunk(chunk, process.stderr));

  if (provider === "ngrok") {
    ngrokProbeTimer = setInterval(async () => {
      maybeAnnounceOrigin(await tryFetchNgrokTunnelUrl());
    }, 1_500);
    ngrokProbeTimer.unref();
  }

  const shutdown = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  child.on("exit", (code, signal) => {
    if (ngrokProbeTimer) {
      clearInterval(ngrokProbeTimer);
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    if (ngrokProbeTimer) {
      clearInterval(ngrokProbeTimer);
    }

    console.error(error.message);
    process.exit(1);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
