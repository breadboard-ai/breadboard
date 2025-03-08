/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";
import type { GraphDescriptor } from "@breadboard-ai/types";
import * as errors from "../errors.js";
import type { BoardServerStore } from "../types.js";

async function get(_req: Request, res: Response) {
  try {
    const { user, name } = res.locals.boardId;
    const store: BoardServerStore = res.app.locals.store;

    const board = await store.get(user, name);
    const graphDescriptor = JSON.parse(board) as GraphDescriptor;
    if (graphDescriptor.metadata?.tags?.includes("private")) {
      if (res.locals.userId != user) {
        errors.unauthorized(res);
        return;
      }
    }
    res.json(graphDescriptor);
  } catch (e) {
    errors.serverError(res, (e as Error).message);
    return;
  }
}

export default get;
