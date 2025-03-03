/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { getStore } from "../store.js";
import { cors } from "../cors.js";
import type { ServerConfig } from "../config.js";
import { authenticateAndGetUserStore } from "../auth.js";
import type { BoardServerStore } from "../types.js";
import { ok } from "@google-labs/breadboard";

export { serveMeAPI };

async function serveMeAPI(
  config: ServerConfig,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!cors(req, res, config.allowedOrigins)) {
    return;
  }

  let store: BoardServerStore | undefined = undefined;

  const userStore = await authenticateAndGetUserStore(req, res, () => {
    store = getStore();
    return store;
  });
  if (!ok(userStore)) {
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ username: userStore }));
}
