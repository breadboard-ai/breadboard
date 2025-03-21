/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { asPath, type BoardServerStore } from "../store.js";

export type CreateRequest = {
  name: string;
};

async function create(req: Request, res: Response): Promise<void> {
  let store: BoardServerStore = req.app.locals.store;
  let userId: string = res.locals.userId;

  const request = req.body as CreateRequest;
  const name = request.name;
  if (!name) {
    res.sendStatus(400);
    return;
  }

  // If a board by this name already exists, return 400
  // TODO Don't load the whole board, do an "exists" check
  if (
    await store.loadBoard({ name, owner: userId, requestingUserId: userId })
  ) {
    res.sendStatus(400);
    return;
  }

  await store.createBoard(userId, name);
  res.json({ path: asPath(userId, name) });
}

export default create;
