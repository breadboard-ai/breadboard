/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cors from "cors";
import express from "express";
import type { Request, Response } from "express";

import { grant } from "./api/grant.js";
import { list } from "./api/list.js";
import { refresh } from "./api/refresh.js";
import type { ServerConfig } from "./config.js";

export function startServer(port: number, config: ServerConfig) {
  const app = express();

  app.use(
    cors({
      credentials: true,
      // Different browsers allow different max values for max age. The highest
      // seems to be Chromium at 24 hours.
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
      maxAge: 24 * 60 * 60,
      methods: "GET",
      origin: config.allowedOrigins,
    })
  );

  // TODO: #3172 - Error handling
  // TODO: #3172 - Handle HTTP verbs individually

  app.all("/list", async (req: Request, res: Response) =>
    list(req, res, config)
  );

  app.all("/grant", async (req: Request, res: Response) =>
    grant(req, res, config)
  );

  app.all("/refresh", async (req: Request, res: Response) =>
    refresh(req, res, config)
  );

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
