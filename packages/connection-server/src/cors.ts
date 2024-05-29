/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "node:http";

const CORS_HEADERS = {
  // TODO(aomarks) Support configuring other allowed origins.
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers":
    "Content-Type, Access-Control-Allow-Headers, Authorization",
  "Access-Control-Max-Age": 2592000, // 30 days
};

export const cors = (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return null;
  }

  const method = req.method || "GET";
  if (method === "GET") {
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      res.setHeader(key, value);
    }
    return true;
  }

  res.writeHead(405, CORS_HEADERS);
  res.end(`${req.method} is not allowed for the request.`);
  return false;
};
