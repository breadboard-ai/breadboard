/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getUserKey } from "../auth.js";
import { getStore } from "../store.js";
import type { ApiHandler } from "../types.js";

const list: ApiHandler = async (path, req, res) => {
  const store = getStore();
  const userKey = getUserKey(req);
  const boards = await store.list(userKey);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(boards));
  return true;
};

export default list;
