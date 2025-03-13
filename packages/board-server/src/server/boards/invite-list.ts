/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from "express";

import type { BoardId, BoardServerStore } from "../types.js";

async function inviteList(
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
    const invites = await store.listInvites(userId, boardId.name);
    const responseBody = { invites };
    res.json(responseBody);
  } catch (e) {
    next(e);
  }
}

export default inviteList;
