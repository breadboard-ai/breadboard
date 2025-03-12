/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";
import * as errors from "../errors.js";
import type { StorageBoard } from "../store.js";

async function get(req: Request, res: Response) {
  try {
    const board: StorageBoard | null = res.locals.loadedBoard;
    if (!board) {
      res.sendStatus(404);
      return;
    }

    // TODO Fail closed, not open
    // TODO Return 404 or 403, not 401
    if (board.graph?.metadata?.tags?.includes("private")) {
      if (res.locals.userId != req.params["user"]) {
        errors.unauthorized(res);
        return;
      }
    }
    res.json(board.graph);
  } catch (e) {
    errors.serverError(res, (e as Error).message);
    return;
  }
}

export default get;
