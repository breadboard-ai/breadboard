/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";
import * as errors from "../errors.js";
import type { StorageBoard } from "../store.js";
import type { GraphDescriptor } from "@google-labs/breadboard";

async function get(_req: Request, res: Response) {
  try {
    const board: StorageBoard | null = res.locals.loadedBoard;
    if (!board) {
      res.sendStatus(404);
      return;
    }
        const graph = board.graph;
    if (!graph) {
      res.sendStatus(404);
      return;
    }

    // Non-breaking enhancement: attach author's username to graph.metadata.
    const username = board.owner; // StorageBoard.owner is a string
    const enriched: GraphDescriptor = {
      ...graph,
      metadata: {
        ...(graph.metadata ?? {}),
        ...(username ? { username } : {}),
      },
    };

    res.json(enriched);
  } catch (e) {
    errors.serverError(res, (e as Error).message);
    return;
  }
}

export default get;
