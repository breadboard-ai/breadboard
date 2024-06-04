/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingMessage, ServerResponse, createServer } from "http";
import { createServer as createViteServer } from "vite";
import { env } from "process";
import { notFound, serverError } from "./errors.js";
import { cors } from "./cors.js";
import list from "./api/list.js";
import get from "./api/get.js";
import post from "./api/post.js";
import del from "./api/delete.js";
import create from "./api/create.js";
import { serveFile } from "./common.js";

const PORT = env.PORT || 3000;
const HOST = env.HOST || "localhost";
const HOSTNAME = `http://${HOST}:${PORT}`;
const API_ENTRY = "/boards";
const IS_PROD = env.NODE_ENV === "production";

const vite = IS_PROD
  ? null
  : await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
      optimizeDeps: { esbuildOptions: { target: "esnext" } },
    });

const getApiPath = (path: string) => {
  const maybePath = path.slice(API_ENTRY.length);
  if (maybePath.startsWith("/")) {
    return maybePath.slice(1);
  }
  return maybePath;
};

const serveFiles = async (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
) => {
  if (vite === null) {
    serveFile(res, pathname);
  } else {
    vite.middlewares(req, res);
  }
};

const serveIndex = async (res: ServerResponse) => {
  if (vite === null) {
    return serveFile(res, "/index.html");
  }
  serveFile(res, "/", async (contents: string) => {
    return await vite.transformIndexHtml("/index.html", contents);
  });
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
  const isBoardServer = pathname.startsWith(API_ENTRY);
  const isApp = pathname.endsWith(".app");
  if (!isBoardServer) {
    return serveFiles(req, res, pathname);
  }
  if (isApp) {
    // Serve the index.html file for the app.
    return serveIndex(res);
  }
  const apiPath = getApiPath(pathname);
  try {
    if (apiPath.length === 0) {
      if (req.method === "GET") {
        if (await list(apiPath, req, res)) return true;
      } else if (req.method === "POST") {
        if (await create(apiPath, req, res)) return true;
      }
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
