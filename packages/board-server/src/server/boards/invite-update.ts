/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@google-labs/breadboard";
import { authenticateAndGetUserStore } from "../auth.js";
import { getStore } from "../store.js";
import type {
  ApiHandler,
  BoardParseResult,
  BoardServerStore,
} from "../types.js";

const updateInvite: ApiHandler = async (parsed, req, res, body) => {
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
    // create new invite
    const result = await store.createInvite(userStore, path);
    let responseBody;
    if (!result.success) {
      responseBody = { error: result.error };
    } else {
      responseBody = { invite: result.invite };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(responseBody));
    return true;
  } else {
    // delete invite
    const del = body as { delete: string };
    if (!del.delete) {
      return false;
    }
    const result = await store.deleteInvite(userStore, path, del.delete);
    let responseBody;
    if (!result.success) {
      // TODO: Be nice and return a proper error code
      responseBody = { error: result.error };
    } else {
      responseBody = { deleted: del.delete };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(responseBody));
    return true;
  }
};

export default updateInvite;
