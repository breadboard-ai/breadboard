/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { getBody } from "../common.js";
import type { ServerConfig } from "../config.js";
import { secretsKit } from "../proxy/secrets.js";

import { createBoardLoader } from "./utils/board-server-provider.js";
import { invokeBoard } from "./utils/invoke-board.js";
import { verifyKey } from "./utils/verify-key.js";
import type { BoardId, BoardServerStore } from "../types.js";
import { asPath } from "../store.js";

async function invokeHandler(
  config: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  const store: BoardServerStore = req.app.locals.store;

  const boardId: BoardId = res.locals.boardId;

  const serverUrl = (await store.getServerInfo())?.url ?? "";

  const url = new URL(req.url, config.hostname);
  const path = asPath(boardId.user, boardId.name);
  url.pathname = `boards/${path}`;
  url.search = "";

  const body = (await getBody(req)) as Record<string, any> | undefined;
  const inputs = body ?? {};

  if (!(await verifyKey(inputs, store))) {
    // TODO Consider sending 404 instead to prevent leaking the existence of
    // the board
    res.sendStatus(403);
    return;
  }

  const result = await invokeBoard({
    serverUrl,
    url: url.href,
    path,
    inputs,
    loader: createBoardLoader(store),
    kitOverrides: [secretsKit],
  });
  res.json(result);
}

export default invokeHandler;
