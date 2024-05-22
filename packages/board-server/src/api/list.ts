/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ApiHandler } from "../types.js";

const list: ApiHandler = async (path, req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(["bobs-boards/cool-board.bgl.json"]));
  return true;
};

export default list;
