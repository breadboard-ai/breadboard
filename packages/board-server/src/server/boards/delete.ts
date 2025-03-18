/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from "express";

import { asPath, type BoardServerStore } from "../store.js";
import type { BoardId } from "../types.js";

async function del(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const store: BoardServerStore = req.app.locals.store;

  const boardId: BoardId = res.locals.boardId;
  const userId: string = res.locals.userId;

  if (userId != boardId.user) {
    // TODO factor this check to middleware
    res.sendStatus(403);
    return;
  }

  try {
    await store.deleteBoard(userId, boardId.name);
  } catch (e) {
    next(e);
  }

  // TODO don't return a response on delete. 200 OK is sufficient
  res.json({ deleted: asPath(boardId.user, boardId.name) });
}

export default del;
