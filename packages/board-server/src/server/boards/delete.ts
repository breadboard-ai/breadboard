/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@google-labs/breadboard";
import { authenticateAndGetUserStore } from "../auth.js";
import { badRequest } from "../errors.js";
import { getStore } from "../store.js";
import type {
  ApiHandler,
  BoardParseResult,
  BoardServerStore,
} from "../types.js";

const del: ApiHandler = async (parsed, req, res, body) => {
  const { board: path } = parsed as BoardParseResult;

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

  if (!body) {
    badRequest(res, "No body provided");
    return true;
  }

  const maybeDelete = body as { delete: boolean };

  if (maybeDelete.delete !== true) {
    return false;
  }

  const result = await store.delete(userStore, path);
  if (!result.success) {
    badRequest(res, result.error!);
    return true;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ deleted: path }));
  return true;
};

export default del;
