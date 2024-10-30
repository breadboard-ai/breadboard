/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer } from "node:http";
import { env } from "node:process";
import { loadConnections, type ServerConfig } from "./config.js";
import { startServer } from "./server.js";

const configPath = process.env["CONNECTIONS_FILE"];
const config: ServerConfig = {
  connections: configPath ? await loadConnections(configPath) : new Map(),
  allowedOrigins: new Set(
    (process.env["ALLOWED_ORIGINS"] ?? "")
      .split(/\s+/)
      .filter((origin) => origin !== "")
  ),
};
if (config.connections.size === 0) {
  console.log(
    `
┌─────────────────────────────────────────────────────────────────────────┐
│ Breadboard Connection Server                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ No connection configurations were discovered, so no connections will be │
│ available from this Breadboard Connection Server.                       │
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

const app = express();

try {
  startServer(port, config);
} catch (e) {
  console.error(e);
  if ((e as { code?: string }).code === "EADDRINUSE") {
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
}
