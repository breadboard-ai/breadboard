/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";

import { methodNotAllowed } from "../errors.js";
import { getBody, serveFile, serveIndex } from "../common.js";
import type { ServerConfig } from "../config.js";
import { cors, corsAll } from "../cors.js";
import { getStore } from "../store.js";
import type { BoardParseResult, PageMetadata } from "../types.js";

import list from "./list.js";
import create from "./create.js";
import get from "./get.js";
import post from "./post.js";
import del from "./delete.js";
import invoke from "./invoke.js";
import describe from "./describe.js";
import inviteList from "./invite-list.js";
import inviteUpdate from "./invite-update.js";
import { parse } from "./utils/board-api-parser.js";
import run from "./run.js";

const getMetadata = (parsed: BoardParseResult) => {
  const { user, name } = parsed;
  return async (): Promise<PageMetadata | null> => {
    const store = getStore();
    const board = await store.get(user!, name!);
    try {
      return JSON.parse(board) as PageMetadata;
    } catch {
      return null;
    }
  };
};

export const serveBoardsAPI = async (
  serverConfig: ServerConfig,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> => {
  const url = new URL(req.url || "", serverConfig.hostname);
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
    case "options": {
      corsAll(req, res);
      return true;
    }
    case "list": {
      if (!cors(req, res, serverConfig.allowedOrigins)) return true;
      if (await list(parsed, req, res)) return true;
      break;
    }
    case "create": {
      if (!cors(req, res, serverConfig.allowedOrigins)) return true;
      if (await create(parsed, req, res)) return true;
      break;
    }
    case "get": {
      if (!corsAll(req, res)) return true;
      if (await get(parsed, req, res)) return true;
      break;
    }
    case "update": {
      if (!cors(req, res, serverConfig.allowedOrigins)) return true;
      const body = await getBody(req);
      if (await post(parsed, req, res, body)) return true;
      if (await del(parsed, req, res, body)) return true;
      break;
    }
    case "app": {
      // Serve the index.html file for the app.
      serveIndex(serverConfig, res, getMetadata(parsed));
      return true;
    }
    case "api": {
      serveFile(serverConfig, res, "/api.html");
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
    case "run": {
      if (!corsAll(req, res)) return true;
      const body = await getBody(req);
      if (await run(parsed, req, res, body)) return true;
      break;
    }
    case "invite-list": {
      if (!cors(req, res, serverConfig.allowedOrigins)) return true;
      if (await inviteList(parsed, req, res)) return true;
      break;
    }
    case "invite-update": {
      if (!cors(req, res, serverConfig.allowedOrigins)) return true;
      const body = await getBody(req);
      if (await inviteUpdate(parsed, req, res, body)) return true;
      break;
    }
    default: {
      return false;
    }
  }
  return false;
};
