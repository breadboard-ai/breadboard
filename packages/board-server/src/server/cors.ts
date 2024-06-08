/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Access-Control-Allow-Headers, Authorization",
  "Access-Control-Max-Age": 2592000, // 30 days
} as Record<string, string | number>;

export const cors = (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return false;
  }

  const method = req.method || "GET";
  if (["GET", "POST", "DELETE"].indexOf(method) > -1) {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return true;
  }

  res.writeHead(405, CORS_HEADERS);
  res.end(`${req.method} is not allowed for the request.`);
  return false;
};
