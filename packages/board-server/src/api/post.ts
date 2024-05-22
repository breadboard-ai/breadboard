/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ApiHandler } from "../types.js";

const post: ApiHandler = async (path, req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ created: path }));
  return true;
};

export default post;
