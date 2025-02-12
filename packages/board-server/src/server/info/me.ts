/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { getStore } from "../store.js";
import { methodNotAllowed } from "../errors.js";
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
): Promise<boolean> {
  const path = new URL(req.url!, "http://localhost").pathname;
  const isMe = path === "/me";
  if (!isMe) {
    return false;
  }

  if (!cors(req, res, config.allowedOrigins)) {
    return true;
  }

  if (req.method !== "GET") {
    methodNotAllowed(res, "Only GET is allowed for /me");
    return true;
  }

  let store: BoardServerStore | undefined = undefined;

  const userStore = await authenticateAndGetUserStore(req, res, () => {
    store = getStore();
    return store;
  });
  if (!ok(userStore)) {
    return true;
  }

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ username: userStore }));

  return true;
}
