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
  if (userKey) {
    // This is likely the "initial connection" situation, where
    // the user key is being used to determine whether this
    // is a valid server connection.
    const result = await store.getUserStore(userKey);
    if (!result.success) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: result.error }));
      return true;
    }
  }

  const boards = await store.list();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(boards));
  return true;
};

export default list;
