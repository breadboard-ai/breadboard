/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { serverError } from "../errors.js";
import { serveFile, serveIndex } from "../common.js";
import list from "./list.js";
import create from "./create.js";
import get from "./get.js";
import post from "./post.js";
import del from "./delete.js";
import type { ViteDevServer } from "vite";

const API_ENTRY = "/boards";
const getApiPath = (path: string) => {
  const maybePath = path.slice(API_ENTRY.length);
  if (maybePath.startsWith("/")) {
    return maybePath.slice(1);
  }
  return maybePath;
};

const getBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: string[] = [];

  return new Promise<unknown>((resolve) => {
    req.on("data", (chunk) => {
      chunks.push(chunk.toString());
    });

    req.on("end", () => {
      resolve(JSON.parse(chunks.join("")));
    });
  });
};

export const serveBoardsAPI = async (
  url: URL,
  vite: ViteDevServer | null,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> => {
  const { pathname } = url;

  const isBoardServer = pathname.startsWith(API_ENTRY);
  const isApp = pathname.endsWith(".app");
  const isAPI = pathname.endsWith(".api");

  if (!isBoardServer) {
    return false;
  }
  if (isApp) {
    // Serve the index.html file for the app.
    serveIndex(vite, res);
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
        const body = await getBody(req);
        if (await post(apiPath, req, res, body)) return true;
        if (await del(apiPath, req, res, body)) return true;
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
