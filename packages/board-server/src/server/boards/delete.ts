/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { authenticate } from "../auth.js";
import { badRequest, unauthorized } from "../errors.js";
import { getStore } from "../store.js";
import type { ApiHandler, BoardParseResult } from "../types.js";

const del: ApiHandler = async (parsed, req, res, body) => {
  const { board: path } = parsed as BoardParseResult;

  const userKey = authenticate(req, res);
  if (!userKey) {
    return true;
  }

  const store = getStore();
  const userStore = await store.getUserStore(userKey);
  if (!userStore.success) {
    unauthorized(res, userStore.error);
    return true;
  }

  if (!body) {
    badRequest(res, "No body provided");
    return true;
  }

  const maybeDelete = body as { delete: boolean };

  if (maybeDelete.delete !== true) {
    return false;
  }

  const result = await store.delete(userStore.store, path);
  if (!result.success) {
    badRequest(res, result.error!);
    return true;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ deleted: path }));
  return true;
};

export default del;
