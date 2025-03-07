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

export type CreateRequest = {
  name: string;
  dryRun?: boolean;
};

async function create(req: Request, res: Response): Promise<void> {
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

  const createRequest = req.body as CreateRequest;
  const name = createRequest.name;
  const result = await store!.create(userStore, name, !!createRequest.dryRun);

  if (result.success) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ path: result.path }));
  } else {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: result.error }));
  }
}

export default create;
