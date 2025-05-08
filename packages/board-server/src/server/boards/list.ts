/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from "express";

import { asPath, type BoardServerStore, type StorageBoard } from "../store.js";

type BoardListEntry = {
  title: string;
  description?: string;
  path: string;
  username: string;
  readonly: boolean;
  mine: boolean;
  tags: string[];
  thumbnail?: string;
};

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const store: BoardServerStore = req.app.locals.store;
    const userId = res.locals.userId;
    const boards: StorageBoard[] = await store.listBoards(userId);

    const response = boards.map((board) => toListEntry(userId, board));
    res.json(response);
  } catch (err) {
    console.log(err);
    next(err);
  }
}

function toListEntry(userId: string, board: StorageBoard): BoardListEntry {
  return {
    title: board.displayName,
    description: board.description ?? undefined,
    path: asPath(board.owner, board.name),
    username: board.owner,
    readonly: board.owner !== userId,
    mine: board.owner === userId,
    tags: board.tags,
    thumbnail: board.thumbnail || undefined,
  };
}

export default list;
