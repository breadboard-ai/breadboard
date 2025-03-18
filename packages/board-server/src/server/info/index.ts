/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Request, type Response, Router } from "express";

import packageInfo from "../../../package.json" with { type: "json" };

import type { ServerInfo, BoardServerStore } from "../store.js";

const DEFAULT_SERVER_INFO: ServerInfo = {
  title: "Board Server",
  description: "A server for Breadboard boards",
  capabilities: {
    boards: {
      path: "/boards",
      read: "open",
      write: "key",
    },
  },
};

export function serveInfoAPI(): Router {
  const router = Router();

  router.get("/", get);

  return router;
}

async function get(req: Request, res: Response): Promise<void> {
  const store: BoardServerStore = req.app.locals.store;
  const info = (await store.getServerInfo()) || DEFAULT_SERVER_INFO;
  const version = packageInfo.version;

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ...info, version }));
}
