/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Store } from "../store.js";
import type { ApiHandler } from "../types.js";

const get: ApiHandler = async (path, req, res) => {
  const store = new Store("server-board");
  const userKey = "dimitri";

  const board = await store.get(userKey, path);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(board);
  return true;
};

export default get;
