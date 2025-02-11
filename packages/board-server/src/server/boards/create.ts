/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@google-labs/breadboard";
import { authenticateAndGetUserStore } from "../auth.js";
import { getStore } from "../store.js";
import type { ApiHandler, BoardServerStore } from "../types.js";

export type CreateRequest = {
  name: string;
  dryRun?: boolean;
};

const create: ApiHandler = async (_path, req, res) => {
  let store: BoardServerStore | undefined = undefined;

  const userStore = await authenticateAndGetUserStore(req, res, () => {
    store = getStore();
    return store;
  });
  if (!ok(userStore)) {
    return true;
  }
  if (!store) {
    store = getStore();
  }

  const chunks: string[] = [];

  return new Promise<boolean>((resolve) => {
    req.on("data", (chunk) => {
      chunks.push(chunk.toString());
    });

    req.on("end", async () => {
      const request = JSON.parse(chunks.join("")) as CreateRequest;
      const name = request.name;
      const result = await store!.create(userStore, name, !!request.dryRun);

      if (!result.success) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: result.error }));
        resolve(false);
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ path: result.path }));
      resolve(true);
    });
  });
};

export default create;
