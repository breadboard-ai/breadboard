/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { ok, type GraphDescriptor } from "@google-labs/breadboard";

import { badRequest } from "../errors.js";

import del from "./delete.js";
import type { BoardId, BoardServerStore } from "../types.js";

async function post(req: Request, res: Response): Promise<void> {
  const body = req.body;

  // We handle deletion by accepting a POST request with { delete: true } in the body
  // TODO Don't do this. Use HTTP DELETE instead.
  const maybeDelete = body as { delete: boolean };
  if (maybeDelete.delete === true) {
    await del(req, res);
  } else {
    await update(req, res, body);
  }
}

async function update(
  req: Request,
  res: Response,
  body: unknown
): Promise<void> {
  const store: BoardServerStore = req.app.locals.store;

  const boardId: BoardId = res.locals.boardId;
  const userId: string = res.locals.userId;

  if (!body) {
    badRequest(res, "No body provided");
    return;
  }

  const maybeGraph = body as GraphDescriptor;

  if (
    !(("nodes" in maybeGraph && "edges" in maybeGraph) || "main" in maybeGraph)
  ) {
    badRequest(res, "Malformed body");
    return;
  }

  const result = await store.update(userId, boardId.fullPath, maybeGraph);
  if (!result.success) {
    badRequest(res, result.error);
    return;
  }

  res.json({ created: boardId.fullPath });
}

export default post;
