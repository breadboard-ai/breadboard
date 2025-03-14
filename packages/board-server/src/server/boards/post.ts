/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from "express";

import { type GraphDescriptor } from "@google-labs/breadboard";

import { getBody } from "../common.js";

import del from "./delete.js";
import type { BoardId, BoardServerStore } from "../types.js";
import { asPath } from "../store.js";

async function post(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const body = await getBody(req);

  // We handle deletion by accepting a POST request with { delete: true } in the body
  // TODO Don't do this. Use HTTP DELETE instead.
  const maybeDelete = body as { delete: boolean };
  if (maybeDelete.delete === true) {
    await del(req, res, next);
  } else {
    await update(req, res, next, body);
  }
}

async function update(
  req: Request,
  res: Response,
  next: NextFunction,
  body: unknown
): Promise<void> {
  const store: BoardServerStore = req.app.locals.store;

  const boardId: BoardId = res.locals.boardId;
  const userId: string = res.locals.userId;

  if (userId != boardId.user) {
    // TODO factor this check to middleware
    res.sendStatus(403);
    return;
  }
  if (!body) {
    // TODO Error body
    res.sendStatus(400);
    return;
  }

  const maybeGraph = body as GraphDescriptor;
  if (
    !(("nodes" in maybeGraph && "edges" in maybeGraph) || "main" in maybeGraph)
  ) {
    // TODO Error body
    res.sendStatus(400);
    return;
  }

  try {
    await store.update(boardId.user, boardId.name, maybeGraph);
    res.json({ created: asPath(boardId.user, boardId.name) });
  } catch (e) {
    next(e);
  }
}

export default post;
