/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { getStore } from "../store.js";
import type { ApiHandler, BoardParseResult } from "../types.js";
import { serverError } from "../errors.js";
import { authenticate } from "../auth.js";
import { ok } from "@google-labs/breadboard";

const get: ApiHandler = async (parsed, req, res) => {
  const { user, name } = parsed as BoardParseResult;

  const store = getStore();

  const board = await store.get(user!, name!);

  try {
    const graphDescriptor = JSON.parse(board) as GraphDescriptor;
    if (graphDescriptor.metadata?.tags?.includes("private")) {
      const authenticating = await authenticate(req, res);
      if (!ok(authenticating)) {
        return true;
      }
    }
  } catch (e) {
    serverError(res, (e as Error).message);
    return true;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(board);
  return true;
};

export default get;
