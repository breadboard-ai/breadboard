/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getUserKey } from "../auth.js";
import { unauthorized } from "../errors.js";
import { Store } from "../store.js";
import type { ApiHandler } from "../types.js";

const getBoardName = (path: string) => {
  const pathParts = path.split("/");
  if (pathParts.length > 1) {
    return pathParts[1] as string;
  }
  return path;
};

const del: ApiHandler = async (path, req, res) => {
  const userKey = getUserKey(req);
  if (!userKey) {
    unauthorized(res, "No user key");
    return true;
  }

  const store = new Store("server-board");

  await store.delete(userKey, getBoardName(path));

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ deleted: path }));
  return true;
};

export default del;
