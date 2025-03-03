/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { getStore, type ServerInfo } from "../store.js";
import { methodNotAllowed } from "../errors.js";
import { corsAll } from "../cors.js";
import packageInfo from "../../../package.json" with { type: "json" };

const DEFAULT_SERVER_INFO: ServerInfo = {
  title: "Board Server",
  description: "A server for Breadboard boards",
  capabilities: {
    boards: {
      path: "/boards",
      read: "open",
      write: "key",
    },
  },
};

export async function serveInfoAPI(req: IncomingMessage, res: ServerResponse) {
  if (!corsAll(req, res)) {
    return;
  }

  const store = getStore();
  const info = (await store.getServerInfo()) || DEFAULT_SERVER_INFO;
  const version = packageInfo.version;

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ...info, version }));
}
