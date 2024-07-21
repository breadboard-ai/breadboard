/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { methodNotAllowed, serverError } from "../errors.js";
import { serveFile, serveIndex } from "../common.js";
import list from "./list.js";
import create from "./create.js";
import get from "./get.js";
import post from "./post.js";
import del from "./delete.js";
import type { ViteDevServer } from "vite";
import invoke from "./invoke.js";
import describe from "./describe.js";
import { parse } from "./utils/board-api-parser.js";

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
  const parsed = parse(url, req.method);

  if (!parsed.success) {
    if (parsed.code === 404) {
      return false;
    }
    if (parsed.code === 405) {
      methodNotAllowed(res, parsed.error);
      return true;
    }
    return false;
  }

  switch (parsed.type) {
    case "list": {
      if (await list("", req, res)) return true;
      break;
    }
    case "create": {
      if (await create("", req, res)) return true;
      break;
    }
    case "get": {
      if (await get(parsed.board, req, res)) return true;
      break;
    }
    case "update": {
      const body = await getBody(req);
      if (await post(parsed.board, req, res, body)) return true;
      if (await del(parsed.board, req, res, body)) return true;
      break;
    }
    case "app": {
      // Serve the index.html file for the app.
      serveIndex(vite, res);
      return true;
    }
    case "api": {
      serveFile(res, "/api.html");
      return true;
    }
    case "invoke": {
      const body = await getBody(req);
      if (await invoke(parsed.board, req, res, body)) return true;
      break;
    }
    case "describe": {
      if (await describe(parsed.board, req, res)) return true;
      break;
    }
    default: {
      return false;
    }
  }
  return false;
};
