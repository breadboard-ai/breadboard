/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { ok } from "@google-labs/breadboard";
import { authenticateAndGetUserStore } from "../auth.js";
import { badRequest } from "../errors.js";
import { getStore } from "../store.js";
import type { BoardServerStore } from "../types.js";

async function del(req: Request, res: Response): Promise<void> {
  const boardPath = res.locals.boardId.fullPath;
  let store: BoardServerStore | undefined = undefined;

  const userStore = await authenticateAndGetUserStore(req, res, () => {
    store = getStore();
    return store;
  });
  if (!ok(userStore)) {
    return;
  }

  if (!store) {
    store = getStore();
  }

  const result = await store.delete(userStore, boardPath);
  if (!result.success) {
    badRequest(res, result.error!);
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ deleted: boardPath }));
}

export default del;
