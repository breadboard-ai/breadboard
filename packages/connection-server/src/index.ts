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

const host = env.HOST || "localhost";
const port = env.PORT ? Number(env.PORT) : 5555;
const server = createServer(makeRouter(config));
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
