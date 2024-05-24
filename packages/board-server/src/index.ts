/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "http";
import { env } from "process";
import { serverError } from "./errors.js";
import list from "./api/list.js";
import get from "./api/get.js";
import post from "./api/post.js";
import del from "./api/delete.js";
import { cors } from "./cors.js";

const PORT = env.PORT || 3000;
const HOST = env.HOST || "localhost";
const HOSTNAME = `http://${HOST}:${PORT}`;
const API_ENTRY = "/boards";

const getApiPath = (path: string) => {
  const maybePath = path.slice(API_ENTRY.length);
  if (maybePath.startsWith("/")) {
    return maybePath.slice(1);
  }
  return maybePath;
};

const server = createServer(async (req, res) => {
  if (!cors(req, res)) {
    return;
  }

  const url = req.url;
  if (!url) {
    return;
  }
  const resolvedURL = URL.canParse(url, HOSTNAME)
    ? new URL(url, HOSTNAME)
    : null;
  if (!resolvedURL) {
    serverError(res, `Invalid URL: ${url}`);
    return;
  }

  const pathname = resolvedURL.pathname;
  if (!pathname.startsWith(API_ENTRY)) {
    serverError(res, `Not found: ${url}`);
    return;
  }
  const apiPath = getApiPath(pathname);
  try {
    if (apiPath.length === 0) {
      if (await list(apiPath, req, res)) return true;
    } else {
      if (req.method === "GET") {
        if (await get(apiPath, req, res)) return true;
      } else if (req.method === "POST") {
        if (await post(apiPath, req, res)) return true;
      } else if (req.method === "DELETE") {
        if (await del(apiPath, req, res)) return true;
      } else {
        serverError(res, `Method not allowed: ${req.method}`);
        return;
      }
    }
  } catch (e) {
    serverError(res, `API Error: ${e}`);
    return;
  }
});

server.listen(PORT, () => {
  console.info(`Running on "${HOSTNAME}"...`);
});
