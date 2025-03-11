/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { getBody } from "../common.js";
import type { BoardId, BoardServerStore } from "../types.js";

async function updateInvite(req: Request, res: Response): Promise<void> {
  const store: BoardServerStore = req.app.locals.store;
  const boardId: BoardId = res.locals.boardId;
  const userId: string = res.locals.userId;

  const body = await getBody(req);
  if (!body) {
    // create new invite
    const result = await store.createInvite(userId, boardId.fullPath);
    let responseBody;
    if (!result.success) {
      responseBody = { error: result.error };
    } else {
      responseBody = { invite: result.invite };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(responseBody));
    return;
  } else {
    // delete invite
    const del = body as { delete: string };
    if (!del.delete) {
      return;
    }
    const result = await store.deleteInvite(
      userId,
      boardId.fullPath,
      del.delete
    );
    let responseBody;
    if (!result.success) {
      // TODO: Be nice and return a proper error code
      responseBody = { error: result.error };
    } else {
      responseBody = { deleted: del.delete };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(responseBody));
  }
}

export default updateInvite;
