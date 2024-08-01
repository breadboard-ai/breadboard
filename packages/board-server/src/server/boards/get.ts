/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { serverError } from "../errors.js";
import { asInfo, getStore } from "../store.js";
import type { ApiHandler, BoardParseResult } from "../types.js";

const get: ApiHandler = async (parsed, req, res) => {
  const { user, name } = parsed as BoardParseResult;

  const store = getStore();

  const board = await store.get(user!, name!);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(board);
  return true;
};

export default get;
