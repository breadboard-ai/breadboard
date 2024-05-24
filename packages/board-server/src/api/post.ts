/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Store } from "../store.js";
import type { ApiHandler } from "../types.js";

const post: ApiHandler = async (path, req, res) => {
  const store = new Store("server-board");
  const userKey = "dimitri";

  let chunks: string[] = [];

  return new Promise<boolean>((resolve) => {
    req.on("data", (chunk) => {
      chunks.push(chunk.toString());
    });

    req.on("end", async () => {
      const graph = JSON.parse(chunks.join(""));
      await store.create(userKey, path, graph);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ created: path }));
      resolve(true);
    });
  });
};

export default post;
