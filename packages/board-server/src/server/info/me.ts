/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Request, type Response, Router } from "express";

import { ok } from "@google-labs/breadboard";

import { getStore } from "../store.js";
import { cors } from "../cors.js";
import type { ServerConfig } from "../config.js";
import { authenticateAndGetUserStore } from "../auth.js";
import type { BoardServerStore } from "../types.js";

export { serveMeAPI };

function serveMeAPI(config: ServerConfig): Router {
  let router = Router();

  router.use(cors(config.allowedOrigins));
  router.get("/", get);

  return router;
}

async function get(req: Request, res: Response): Promise<void> {
  let store: BoardServerStore | undefined = undefined;

  const userStore = await authenticateAndGetUserStore(req, res, () => {
    store = getStore();
    return store;
  });
  if (!ok(userStore)) {
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ username: userStore }));
}
