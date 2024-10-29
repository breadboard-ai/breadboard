/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import type { IncomingMessage, ServerResponse } from "node:http";

import { grant } from "./api/grant.js";
import { list } from "./api/list.js";
import { refresh } from "./api/refresh.js";
import type { ServerConfig } from "./config.js";
import { cors } from "./cors.js";

export function startServer(port: number, config: ServerConfig) {
  const app = express();

  // TODO: #3172 - Refactor cors check to middleware
  // TODO: #3172 - Error handling
  // TODO: #3172 - Handle HTTP verbs individually

  app.all("/list", async (req, res) => {
    if (!cors(req, res, config.allowedOrigins)) {
      return;
    }
    await list(req, res, config);
  });

  app.all("/grant", async (req, res) => {
    if (!cors(req, res, config.allowedOrigins)) {
      return;
    }
    await grant(req, res, config);
  });

  app.all("/refresh", async (req, res) => {
    if (!cors(req, res, config.allowedOrigins)) {
      return;
    }
    await refresh(req, res, config);
  });

  app.listen(port, () => {
    console.info(
      `
┌─────────────────────────────────────────────────────────────────────────┐
│ Breadboard Connection Server                                            │
├─────────────────────────────────────────────────────────────────────────┘
│ Listening on port ${port}...
└──────────────────────────────────────────────────────────────────────────
`
    );
  });
}
