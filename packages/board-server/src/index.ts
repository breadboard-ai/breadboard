/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingMessage, ServerResponse, createServer } from "http";
import { createServer as createViteServer } from "vite";
import { env } from "process";
import { serverError } from "./server/errors.js";
import { cors } from "./server/cors.js";
import list from "./server/boards/list.js";
import get from "./server/boards/get.js";
import post from "./server/boards/post.js";
import del from "./server/boards/delete.js";
import create from "./server/boards/create.js";
import { serveFile } from "./server/common.js";

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

const serveFiles = async (req: IncomingMessage, res: ServerResponse) => {
  const pathname = req.url || "/";
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

const serveBoardsAPI = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> => {
  const pathname = req.url;
  if (!pathname) {
    serverError(res, "Empty url");
    return true;
  }

  const isBoardServer = pathname.startsWith(API_ENTRY);
  const isApp = pathname.endsWith(".app");
  const isAPI = pathname.endsWith(".api");

  if (!isBoardServer) {
    return false;
  }
  if (isApp) {
    // Serve the index.html file for the app.
    serveIndex(res);
    return true;
  }
  if (isAPI) {
    serveFile(res, "/api.html");
    return true;
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
        return true;
      }
    }
  } catch (e) {
    serverError(res, `API Error: ${e}`);
  }
  return true;
};

const server = createServer(async (req, res) => {
  if (!cors(req, res)) {
    return;
  }

  if (!(await serveBoardsAPI(req, res))) {
    serveFiles(req, res);
  }
});

server.listen(PORT, () => {
  console.info(`Running on "${HOSTNAME}"...`);
});
