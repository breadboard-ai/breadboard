/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";
import * as errors from "../errors.js";
import type { StorageBoard } from "../store.js";

async function get(_req: Request, res: Response) {
  try {
    const board: StorageBoard | null = res.locals.loadedBoard;
    if (!board) {
      res.sendStatus(404);
      return;
    }
    res.json(board.graph);
  } catch (e) {
    errors.serverError(res, (e as Error).message);
    return;
  }
}

export default get;
