/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@google-labs/breadboard";
import { authenticate } from "../auth.js";
import { serverError } from "../errors.js";
import { getStore } from "../store.js";
import type { ApiHandler } from "../types.js";

const post: ApiHandler = async (path, req, res, body) => {
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
    serverError(res, "No body provided");
    return true;
  }

  const maybeGraph = body as GraphDescriptor;
  if (!("nodes" in maybeGraph && "edges" in maybeGraph)) {
    return false;
  }

  const result = await store.update(userStore.store, path, maybeGraph);
  if (!result.success) {
    serverError(res, result.error);
    return true;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ created: path }));
  return true;
};

export default post;
