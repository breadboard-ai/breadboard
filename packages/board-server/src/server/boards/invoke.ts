/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { getBody } from "../common.js";
import type { ServerConfig } from "../config.js";
import { secretsKit } from "../proxy/secrets.js";

import { loadFromStore } from "./utils/board-server-provider.js";
import { invokeBoard } from "./utils/invoke-board.js";
import { verifyKey } from "./utils/verify-key.js";
import type { BoardId } from "../types.js";
import { asPath } from "../store.js";

async function invokeHandler(
  config: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  const boardId: BoardId = res.locals.boardId;
  const url = new URL(req.url, config.hostname);
  const path = asPath(boardId.user, boardId.name);
  url.pathname = `boards/${path}`;
  url.search = "";

  const body = (await getBody(req)) as Record<string, any> | undefined;
  const inputs = body ?? {};

  if (!(await verifyKey(inputs))) {
    // TODO Consider sending 404 instead to prevent leaking the existence of
    // the board
    res.sendStatus(403);
    return;
  }

  const result = await invokeBoard({
    url: url.href,
    path,
    inputs,
    loader: loadFromStore,
    kitOverrides: [secretsKit],
  });
  res.json(result);
}

export default invokeHandler;
