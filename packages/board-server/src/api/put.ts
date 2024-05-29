/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { authenticate } from "../auth.js";
import { getStore } from "../store.js";
import type { ApiHandler } from "../types.js";

const put: ApiHandler = async (path, req, res) => {
  const userKey = authenticate(req, res);
  if (!userKey) {
    return true;
  }
  const store = getStore();

  const chunks: string[] = [];

  return new Promise<boolean>((resolve) => {
    req.on("data", (chunk) => {
      chunks.push(chunk.toString());
    });

    req.on("end", async () => {
      const graph = JSON.parse(chunks.join(""));
      const result = await store.create(userKey, path, graph);

      if (!result.success) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: result.error }));
        resolve(false);
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ created: result.path }));
      resolve(true);
    });
  });
};

export default put;
