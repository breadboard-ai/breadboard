/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { authenticate } from "../auth.js";
import { serverError } from "../errors.js";
import { getStore } from "../store.js";
import type { ApiHandler } from "../types.js";

const getBoardName = (path: string) => {
  const pathParts = path.split("/");
  if (pathParts.length > 1) {
    return pathParts[1] as string;
  }
  return path;
};

const del: ApiHandler = async (path, req, res) => {
  const userKey = authenticate(req, res);
  if (!userKey) {
    return true;
  }

  const store = getStore();
  const userStore = await store.getUserStore(userKey);
  if (!userStore.success) {
    serverError(res, "Unauthorized");
    return true;
  }

  await store.delete(userStore.store, getBoardName(path));

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ deleted: path }));
  return true;
};

export default del;
