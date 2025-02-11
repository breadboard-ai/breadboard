/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@google-labs/breadboard";
import { authenticate } from "../auth.js";
import { badRequest, unauthorized } from "../errors.js";
import { getStore } from "../store.js";
import type { ApiHandler, BoardParseResult } from "../types.js";

const post: ApiHandler = async (parsed, req, res, body) => {
  const { board: path } = parsed as BoardParseResult;

  const userKey = await authenticate(req, res);
  if (!userKey) {
    unauthorized(res, "Unauthorized");
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

  const maybeGraph = body as GraphDescriptor;

  if (
    !(("nodes" in maybeGraph && "edges" in maybeGraph) || "main" in maybeGraph)
  ) {
    return false;
  }

  const result = await store.update(userStore.store!, path, maybeGraph);
  if (!result.success) {
    badRequest(res, result.error);
    return true;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ created: path }));
  return true;
};

export default post;
