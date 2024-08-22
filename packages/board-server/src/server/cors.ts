/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  IncomingMessage,
  OutgoingHttpHeaders,
  ServerResponse,
} from "http";
import { getStore } from "./store.js";

const CORS_HEADERS: OutgoingHttpHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET, DELETE",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers":
    "Content-Type, Access-Control-Allow-Headers, Authorization",
  "Access-Control-Max-Age": 2592000, // 30 days
};

export const corsAll = (req: IncomingMessage, res: ServerResponse) => {
  const headers = { ...CORS_HEADERS };
  headers["Access-Control-Allow-Origin"] = req.headers.origin || "*";

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return false;
  }

  const method = req.method || "GET";
  if (["GET", "POST"].indexOf(method) > -1) {
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        res.setHeader(key, value);
      }
    }
    return true;
  }

  res.writeHead(405);
  res.end(`${req.method} is not allowed for the request.`);
  return false;
};

export const cors = (
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: Set<string>
) => {
  const headers = { ...CORS_HEADERS };
  const origin = req.headers.origin || "";
  const host = req.headers.host || "";
  const sameOrigin = origin.includes(host);

  const isAllowed =
    sameOrigin || origin.length === 0 || allowedOrigins.has(origin);
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
  if (["GET", "POST"].indexOf(method) > -1) {
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        res.setHeader(key, value);
      }
    }
    return true;
  }

  res.writeHead(405);
  res.end(`${req.method} is not allowed for the request.`);
  return false;
};
