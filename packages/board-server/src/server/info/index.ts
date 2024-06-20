/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { getStore, type ServerInfo } from "../store.js";
import { methodNotAllowed } from "../errors.js";

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

export const serveInfoAPI = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> => {
  const path = req.url;
  const isInfo = path === "/info";
  if (!isInfo) {
    return false;
  }

  if (req.method !== "GET") {
    methodNotAllowed(res, "Only GET is allowed for /info");
    return true;
  }

  const store = getStore();
  const info = (await store.getServerInfo()) || DEFAULT_SERVER_INFO;

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(info));

  return true;
};
