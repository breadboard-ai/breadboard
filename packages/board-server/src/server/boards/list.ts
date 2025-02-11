/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@google-labs/breadboard";
import { authenticateAndGetUserStore } from "../auth.js";
import { getStore } from "../store.js";
import type { ApiHandler, BoardServerStore } from "../types.js";

const list: ApiHandler = async (_path, req, res) => {
  let store: BoardServerStore | undefined = undefined;

  const userStore = await authenticateAndGetUserStore(req, res, () => {
    store = getStore();
    return store;
  });
  if (!ok(userStore)) {
    return true;
  }
  if (!store) {
    store = getStore();
  }

  const boards = await store.list(userStore);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(boards));
  return true;
};

export default list;
