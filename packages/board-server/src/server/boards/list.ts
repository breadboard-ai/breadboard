/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from "express";

import type { BoardServerStore } from "../types.js";

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const store: BoardServerStore = req.app.locals.store;
    const boards = await store.list(res.locals.userId);
    res.json(boards);
  } catch (err) {
    next(err);
  }
}

export default list;
