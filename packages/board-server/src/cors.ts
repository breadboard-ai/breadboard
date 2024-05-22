/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Access-Control-Allow-Headers, Authorization",
  "Access-Control-Max-Age": 2592000, // 30 days
} as Record<string, string | number>;

export const cors = (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return null;
  }

  const method = req.method || "GET";
  if (["GET", "POST", "DELETE"].indexOf(method) > -1) {
    return structuredClone(headers);
  }

  res.writeHead(405, headers);
  res.end(`${req.method} is not allowed for the request.`);
  return null;
};
