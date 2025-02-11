/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok, type GraphDescriptor } from "@google-labs/breadboard";
import { authenticateAndGetUserStore } from "../auth.js";
import { badRequest } from "../errors.js";
import type { ApiHandler, BoardParseResult } from "../types.js";
import { getStore } from "../store.js";

const post: ApiHandler = async (parsed, req, res, body) => {
  const { board: path } = parsed as BoardParseResult;

  let store;

  const userPath = await authenticateAndGetUserStore(req, res, () => {
    store = getStore();
    return store;
  });
  if (!ok(userPath)) {
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

  if (!store) {
    store = getStore();
  }

  const result = await store.update(userPath!, path, maybeGraph);
  if (!result.success) {
    badRequest(res, result.error);
    return true;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ created: path }));
  return true;
};

export default post;
