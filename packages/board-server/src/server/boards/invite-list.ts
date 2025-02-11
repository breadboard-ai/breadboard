/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@google-labs/breadboard";
import { authenticateAndGetUserStore } from "../auth.js";
import { unauthorized } from "../errors.js";
import { getStore } from "../store.js";
import type {
  ApiHandler,
  BoardParseResult,
  BoardServerStore,
} from "../types.js";

const inviteList: ApiHandler = async (parsed, req, res) => {
  const { board: path } = parsed as BoardParseResult;

  let store: BoardServerStore | undefined = undefined;

  const userKey = await authenticateAndGetUserStore(req, res, () => {
    store = getStore();
    return store;
  });
  if (!ok(userKey)) {
    return true;
  }

  if (!store) {
    store = getStore();
  }

  const userStore = await store.getUserStore(userKey);
  if (!userStore.success) {
    unauthorized(res, "Unauthorized");
    return true;
  }

  const result = await store.listInvites(userStore.store, path);
  let responseBody;
  if (!result.success) {
    // TODO: Be nice and return a proper error code
    responseBody = { error: result.error };
  } else {
    responseBody = { invites: result.invites };
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(responseBody));
  return true;
};

export default inviteList;
