/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { authenticate } from "../auth.js";
import { serverError } from "../errors.js";
import { getStore } from "../store.js";
import type { ApiHandler, BoardParseResult } from "../types.js";

const updateInvite: ApiHandler = async (parsed, req, res, body) => {
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

  if (!body) {
    // create new invite
    const result = await store.createInvite(userStore.store, path);
    if (!result.success) {
      serverError(res, result.error);
      return true;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ invite: result.invite }));
    return true;
  } else {
    // delete invite
    const del = body as { delete: string };
    if (!del.delete) {
      return false;
    }
    const result = await store.deleteInvite(userStore.store, path, del.delete);
    if (!result.success) {
      serverError(res, result.error);
      return true;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ deleted: del.delete }));
    return true;
  }
};

export default updateInvite;
