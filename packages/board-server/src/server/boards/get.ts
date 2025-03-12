/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";
import type { GraphDescriptor } from "@breadboard-ai/types";
import * as errors from "../errors.js";
import type { BoardServerStore } from "../types.js";
import type { StorageBoard } from "../store.js";

async function get(req: Request, res: Response) {
  try {
    const board: StorageBoard = res.locals.loadedBoard;

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
