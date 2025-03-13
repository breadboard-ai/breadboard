/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from "express";

import { getBody } from "../common.js";
import { INVITE_EXPIRATION_TIME_MS } from "../store.js";
import type { BoardId, BoardServerStore, Invite } from "../types.js";

async function updateInvite(
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

  const body = await getBody(req);
  if (!body) {
    // create new invite
    const invite: Invite = {
      name: Math.random().toString(36).slice(2, 10),
      expireAt: new Date(Date.now() + INVITE_EXPIRATION_TIME_MS),
    };
    try {
      await store.createInvite(userId, boardId.name, invite);
      res.json({ invite: invite.name });
    } catch (e) {
      next(e);
    }
  } else {
    // delete invite
    const del = body as { delete: string };
    if (!del.delete) {
      res.sendStatus(400);
      return;
    }
    try {
      await store.deleteInvite(userId, boardId.name, del.delete);
      res.json({ deleted: del.delete });
    } catch (e) {
      next(e);
    }
  }
}

export default updateInvite;
