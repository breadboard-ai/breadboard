/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { badRequest } from "../errors.js";
import type { BoardId, BoardServerStore } from "../types.js";

async function del(req: Request, res: Response): Promise<void> {
  const store: BoardServerStore = req.app.locals.store;

  const boardId: BoardId = res.locals.boardId;
  const userId: string = res.locals.userId;

  const result = await store.delete(userId, boardId.fullPath);
  if (!result.success) {
    badRequest(res, result.error!);
    return;
  }

  // TODO don't return a response on delete. 200 OK is sufficient
  res.json({ deleted: boardId.fullPath });
}

export default del;
