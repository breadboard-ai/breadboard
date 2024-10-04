/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { getStore, type ServerInfo } from "../store.js";
import { methodNotAllowed, unauthorized } from "../errors.js";
import { cors } from "../cors.js";
import packageInfo from "../../../package.json" with { type: "json" };
import type { ServerConfig } from "../config.js";
import { getUserKey } from "../auth.js";

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

  const key = getUserKey(req);
  if (!key) {
    unauthorized(res, "No API key provided");
    return true;
  }

  const store = getStore();
  const result = await store.getUserStore(key);

  if (!result.success) {
    unauthorized(res, result.error);
    return true;
  }

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ username: result.store }));

  return true;
}
