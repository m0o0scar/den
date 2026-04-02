import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getFreePort } = require("gfport");

export const DEFAULT_PORT = 3200;

async function findAvailablePort(startPort) {
  return getFreePort(startPort);
}

export async function resolveStartupPort(
  { port: requestedPort, portExplicit = false, env = process.env },
  { findAvailablePortImpl = findAvailablePort } = {},
) {
  const envPort = Number.parseInt(env.PORT || "", 10);
  const preferredPort =
    requestedPort ??
    (Number.isInteger(envPort) && envPort > 0 && envPort <= 65535 ? envPort : DEFAULT_PORT);

  if (portExplicit || env.PORT) {
    return { port: preferredPort, preferredPort };
  }

  return {
    port: await findAvailablePortImpl(preferredPort),
    preferredPort,
  };
}
