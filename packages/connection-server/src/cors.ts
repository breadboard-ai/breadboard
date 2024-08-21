/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  IncomingMessage,
  OutgoingHttpHeaders,
  ServerResponse,
} from "node:http";

const CORS_HEADERS: OutgoingHttpHeaders = {
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers":
    "Content-Type, Access-Control-Allow-Headers, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": 2592000, // 30 days
};

export const cors = (
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: Set<string>
) => {
  const headers = { ...CORS_HEADERS };
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return null;
  }

  const method = req.method || "GET";
  if (method === "GET") {
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        res.setHeader(key, value);
      }
    }
    return true;
  }

  res.writeHead(405, headers);
  res.end(`${req.method} is not allowed for the request.`);
  return false;
};
