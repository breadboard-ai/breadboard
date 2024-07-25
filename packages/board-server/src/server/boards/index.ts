/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { methodNotAllowed } from "../errors.js";
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
import { cors, corsAll } from "../cors.js";

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
      if (!cors(req, res)) return true;
      if (await list(parsed, req, res)) return true;
      break;
    }
    case "create": {
      if (!cors(req, res)) return true;
      if (await create(parsed, req, res)) return true;
      break;
    }
    case "get": {
      if (!cors(req, res)) return true;
      if (await get(parsed, req, res)) return true;
      break;
    }
    case "update": {
      if (!cors(req, res)) return true;
      const body = await getBody(req);
      if (await post(parsed, req, res, body)) return true;
      if (await del(parsed, req, res, body)) return true;
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
      if (!corsAll(req, res)) return true;
      const body = await getBody(req);
      if (await invoke(parsed, req, res, body)) return true;
      break;
    }
    case "describe": {
      if (!corsAll(req, res)) return true;
      if (await describe(parsed, req, res)) return true;
      break;
    }
    default: {
      return false;
    }
  }
  return false;
};
