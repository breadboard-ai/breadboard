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

export function createServer(config: ServerConfig) {
  const app = express();

  app.use(
    cors({
      credentials: true,
      // Different browsers allow different max values for max age. The highest
      // seems to be 24 hours.
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
      maxAge: 24 * 60 * 60,
      origin: config.allowedOrigins,
    })
  );

  // TODO: #3172 - Common error handling

  app.get("/list", async (req: Request, res: Response) =>
    list(req, res, config)
  );

  app.get("/grant", async (req: Request, res: Response) =>
    grant(req, res, config)
  );

  app.get("/refresh", async (req: Request, res: Response) =>
    refresh(req, res, config)
  );

  return app;
}
