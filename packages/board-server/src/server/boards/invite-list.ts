/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { authenticate } from "../auth.js";
import { serverError } from "../errors.js";
import { getStore } from "../store.js";
import type { ApiHandler, BoardParseResult } from "../types.js";

const inviteList: ApiHandler = async (parsed, req, res) => {
  const { board: path } = parsed as BoardParseResult;

  const userKey = authenticate(req, res);
  if (!userKey) {
    serverError(res, "Unauthorized");
    return true;
  }

  const store = getStore();

  const userStore = await store.getUserStore(userKey);
  if (!userStore.success) {
    serverError(res, "Unauthorized");
    return true;
  }

  const result = await store.listInvites(userStore.store, path);
  if (!result.success) {
    serverError(res, result.error);
    return true;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ invites: result.invites }));
  return true;
};

export default inviteList;
