/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { authenticate } from "../auth.js";
import { Store } from "../store.js";
import type { ApiHandler } from "../types.js";

const getBoardName = (path: string) => {
  const pathParts = path.split("/");
  if (pathParts.length > 1) {
    return pathParts[1] as string;
  }
  return path;
};

const post: ApiHandler = async (path, req, res) => {
  const userKey = authenticate(req, res);
  if (!userKey) {
    return true;
  }
  const store = new Store("server-board");

  const chunks: string[] = [];

  return new Promise<boolean>((resolve) => {
    req.on("data", (chunk) => {
      chunks.push(chunk.toString());
    });

    req.on("end", async () => {
      const graph = JSON.parse(chunks.join(""));
      await store.create(userKey, getBoardName(path), graph);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ created: path }));
      resolve(true);
    });
  });
};

export default post;
