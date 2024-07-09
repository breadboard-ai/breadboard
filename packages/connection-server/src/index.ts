/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "node:http";
import { join } from "node:path";
import { cwd, env } from "node:process";
import type { Config } from "./config.js";
import { makeRouter } from "./router.js";
import { loadSecretsFromDisk } from "./secrets.js";

const secretsFolder = join(cwd(), "secrets/");
const config: Config = {
  secrets: await loadSecretsFromDisk(secretsFolder),
  allowedOrigins: new Set(
    (process.env["ALLOWED_ORIGINS"] ?? "")
      .split(/\s+/)
      .filter((origin) => origin !== "")
  ),
};
if (config.secrets.size === 0) {
  console.log(
    `
┌─────────────────────────────────────────────────────────────────────────┐
│ Breadboard Connection Server                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ No connection configurations were discovered, so no connections will be │
│ available from this Breadboard Connection Server.                       │
│                                                                         │
│ To add a connection, place a "<connection-id>.json" file in the folder: │
│                                                                         │
│   ${secretsFolder}
│                                                                         │
│ See README.md#configuring-connections for more information.             │
└─────────────────────────────────────────────────────────────────────────┘
`
  );
}
if (config.allowedOrigins.size === 0) {
  console.log(
    `
┌─────────────────────────────────────────────────────────────────────────┐
│ Breadboard Connection Server                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ No allowed origins were set. Place a space-delimited list of 1+ allowed │
│ origins in the ALLOWED_ORIGINS environment variable and restart.        │
└─────────────────────────────────────────────────────────────────────────┘
`
  );
}
const host = env.HOST || "localhost";
const port = env.PORT ? Number(env.PORT) : 5555;
const server = createServer(makeRouter(config));
server.on("error", (error) => {
  console.error(error);
  if ((error as { code?: string }).code === "EADDRINUSE") {
    console.log(
      `
┌─────────────────────────────────────────────────────────────────────────┐
│ Breadboard Connection Server                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ Port ${port} is in use by another process. Try this command to kill it:    │
│                                                                         │
│   kill $(lsof -i tcp:${port} | tail -n 1 | head -n1 | cut -w -f2)          │
└─────────────────────────────────────────────────────────────────────────┘
`
    );
  }
});

server.listen(port, host, () => {
  console.info(
    `
┌─────────────────────────────────────────────────────────────────────────┐
│ Breadboard Connection Server                                            │
├─────────────────────────────────────────────────────────────────────────┘
│ Listening on "http://${host}:${port}"...
└──────────────────────────────────────────────────────────────────────────
`
  );
});
