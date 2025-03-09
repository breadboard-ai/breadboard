/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import type { BoardId, BoardServerStore } from "../types.js";

async function inviteList(req: Request, res: Response): Promise<void> {
  const store: BoardServerStore = req.app.locals.store;

  const boardId: BoardId = res.locals.boardId;
  const userId: string = res.locals.userId;

  const result = await store.listInvites(userId, boardId.fullPath);
  let responseBody;
  if (!result.success) {
    // TODO: Be nice and return a proper error code
    responseBody = { error: result.error };
  } else {
    responseBody = { invites: result.invites };
  }

  res.json(responseBody);
}

export default inviteList;
