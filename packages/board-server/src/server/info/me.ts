/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Request, type Response, Router } from "express";

import { cors } from "../cors.js";
import type { ServerConfig } from "../config.js";
import { requireAuth } from "../auth.js";

export { serveMeAPI };

function serveMeAPI(config: ServerConfig): Router {
  let router = Router();

  router.use(cors(config.allowedOrigins));
  router.use(requireAuth());

  router.get("/", get);

  return router;
}

async function get(_req: Request, res: Response): Promise<void> {
  const userId: string = res.locals.userId;
  res.json({ username: userId });
}
