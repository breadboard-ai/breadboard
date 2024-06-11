/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { getStore } from "./store.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET, DELETE",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers":
    "Content-Type, Access-Control-Allow-Headers, Authorization",
  "Access-Control-Max-Age": 2592000, // 30 days
} as Record<string, string | number>;

// Read once from the database and cache it.
// TODO: Make this a bit more dynamic.
const CONFIG = await getStore().getBoardServerCorsConfig();

export const cors = (req: IncomingMessage, res: ServerResponse) => {
  const origin = req.headers.origin || "";
  const isLocalhost = origin.includes("localhost");
  const headers = structuredClone(CORS_HEADERS);
  const isAllowed =
    isLocalhost || origin.length === 0 || CONFIG?.allow?.includes(origin);
  if (!isAllowed) {
    res.writeHead(403);
    res.end(`${origin} is not allowed for the request.`);
    return false;
  }

  headers["Access-Control-Allow-Origin"] = origin;

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return false;
  }

  const method = req.method || "GET";
  if (["GET", "POST", "DELETE"].indexOf(method) > -1) {
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return true;
  }

  res.writeHead(405);
  res.end(`${req.method} is not allowed for the request.`);
  return false;
};
