/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import type { Request, Response } from "express";

import { methodNotAllowed } from "../errors.js";
import { getBody, serveFile, serveIndex } from "../common.js";
import type { ServerConfig } from "../config.js";
import { cors, corsAll } from "../cors.js";
import { getStore } from "../store.js";
import type { BoardId, BoardParseResult, PageMetadata } from "../types.js";

import listBoards from "./list.js";
import createBoard from "./create.js";
import getBoard from "./get.js";
import post from "./post.js";
import del from "./delete.js";
import invokeBoard from "./invoke.js";
import describeBoard from "./describe.js";
import inviteList from "./invite-list.js";
import inviteUpdate from "./invite-update.js";
import { parse } from "./utils/board-api-parser.js";
import runBoard from "./run.js";
import handleAssetsDriveRequest from "./assets-drive.js";

function getMetadata(user: string, name: string) {
  return async (): Promise<PageMetadata | null> => {
    const store = getStore();
    const board = await store.get(user!, name!);
    try {
      return JSON.parse(board) as PageMetadata;
    } catch {
      return null;
    }
  };
}

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
    default: {
      return false;
    }
  }
};

export function options(req: Request, res: Response) {
  corsAll(req, res);
}

export async function list(
  serverConfig: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  if (!cors(req, res, serverConfig.allowedOrigins)) {
    return;
  }
  await listBoards(req, res);
}

export async function create(
  serverConfig: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  if (!cors(req, res, serverConfig.allowedOrigins)) {
    return;
  }
  await createBoard(req, res);
}

export async function get(req: Request, res: Response): Promise<void> {
  if (!corsAll(req, res)) {
    return;
  }
  const { user, name } = getBoardId(req);
  await getBoard(user, name, req, res);
}

export async function update(
  serverConfig: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  if (!cors(req, res, serverConfig.allowedOrigins)) {
    return;
  }
  const { fullPath } = getBoardId(req);
  const body = await getBody(req);

  const maybeDelete = body as { delete: boolean };
  if (maybeDelete.delete === true) {
    await del(fullPath, req, res);
  } else {
    await post(fullPath, req, res, body);
  }
}

export async function getApp(
  serverConfig: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  const { user, name } = getBoardId(req);
  // Serve the index.html file for the app.
  await serveIndex(serverConfig, res, getMetadata(user, name));
}

export async function getApi(
  serverConfig: ServerConfig,
  res: Response
): Promise<void> {
  await serveFile(serverConfig, res, "/api.html");
}

export async function invoke(
  serverConfig: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  if (!corsAll(req, res)) {
    return;
  }
  const { fullPath, name, user } = getBoardId(req);
  const url = new URL(req.url, serverConfig.hostname);
  url.pathname = `boards/${fullPath}`;
  url.search = "";

  const body = await getBody(req);
  await invokeBoard(fullPath, user, name, url, res, body);
}

export async function run(
  serverConfig: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  if (!corsAll(req, res)) {
    return;
  }
  const { fullPath, name, user } = getBoardId(req);
  const url = new URL(req.url, serverConfig.hostname);
  url.pathname = `boards/${fullPath}`;
  url.search = "";

  const body = await getBody(req);
  await runBoard(fullPath, user, name, url, res, body);
}

export async function describe(req: Request, res: Response): Promise<void> {
  if (!corsAll(req, res)) {
    return;
  }
  const { name, user } = getBoardId(req);
  await describeBoard(user, name, res);
}

export async function listInvites(
  serverConfig: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  if (!cors(req, res, serverConfig.allowedOrigins)) {
    return;
  }
  const { fullPath } = getBoardId(req);
  await inviteList(fullPath, req, res);
}

export async function updateInvite(
  serverConfig: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  if (!cors(req, res, serverConfig.allowedOrigins)) {
    return;
  }
  const body = await getBody(req);
  const { fullPath } = getBoardId(req);
  await inviteUpdate(fullPath, req, res, body);
}

export async function updateDriveAsset(
  serverConfig: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  if (!cors(req, res, serverConfig.allowedOrigins)) {
    return;
  }
  const driveId = req.params["driveId"] ?? "";
  await handleAssetsDriveRequest(driveId, req, res);
}

function getBoardId(request: Request): BoardId {
  const user = request.params["user"] ?? "";
  const name = (request.params["name"] ?? "") + ".json";
  const fullPath = `@${user}/${name}`;
  return { user, name, fullPath };
}
