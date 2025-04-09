/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import {
  asPath,
  InvalidRequestError,
  type BoardServerStore,
  type StorageBoard,
} from "../store.js";

export type CreateRequest = StorageBoard;

async function create(req: Request, res: Response): Promise<void> {
  const store: BoardServerStore = req.app.locals.store;

  const request = req.body as CreateRequest;

  const userId: string = res.locals.userId;
  if (!request.owner) {
    request.owner = userId;
  } else if (request.owner !== userId) {
    res.statusMessage = `Unexpected owner ${request.owner}`;
    res.sendStatus(400);
  }

  try {
    const result = await store.upsertBoard(request);
    res.json({ ...result,  path: asPath(result.owner, result.name) });
  } catch (e) {
    if (e instanceof InvalidRequestError) {
      res.statusMessage = e.message;
      res.sendStatus(400);
    }
    return;
  }
}

export default create;
