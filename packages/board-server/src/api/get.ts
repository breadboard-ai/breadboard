/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { serverError } from "../errors.js";
import { getStore } from "../store.js";
import type { ApiHandler } from "../types.js";

const get: ApiHandler = async (path, req, res) => {
  const store = getStore();

  const [userStore, boardId] = path.split("/");
  if (!userStore || !boardId) {
    serverError(res, "Invalid path");
    return true;
  }
  const board = await store.get(userStore, boardId);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(board);
  return true;
};

export default get;
