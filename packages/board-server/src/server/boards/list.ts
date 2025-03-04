/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { ok } from "@google-labs/breadboard";

import { authenticateAndGetUserStore } from "../auth.js";
import { getStore } from "../store.js";
import type { BoardServerStore } from "../types.js";

async function list(req: Request, res: Response) {
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

  const boards = await store.list(userStore);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(boards));
}

export default list;
