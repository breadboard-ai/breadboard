/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { authenticate } from "../auth.js";
import { unauthorized } from "../errors.js";
import { getStore } from "../store.js";
import type { ApiHandler, BoardParseResult } from "../types.js";

const updateInvite: ApiHandler = async (parsed, req, res, body) => {
  const { board: path } = parsed as BoardParseResult;

  const userKey = authenticate(req, res);
  if (!userKey) {
    unauthorized(res, "Unauthorized");
    return true;
  }
  const store = getStore();
  const userStore = await store.getUserStore(userKey);
  if (!userStore.success) {
    unauthorized(res, "Unauthorized");
    return true;
  }

  if (!body) {
    // create new invite
    const result = await store.createInvite(userStore.store, path);
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
    const result = await store.deleteInvite(userStore.store, path, del.delete);
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
