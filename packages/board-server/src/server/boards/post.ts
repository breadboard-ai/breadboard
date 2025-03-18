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

  const graph = asGraph(body);
  if (!graph) {
    // TODO Error body
    res.sendStatus(400);
    return;
  }

  try {
    await store.updateBoard({
      name: boardId.name,
      owner: userId,
      displayName: graph.title || boardId.name,
      description: graph.description ?? "",
      tags: graph.metadata?.tags ?? [],
      thumbnail: "",
      graph: graph,
    });
    // TODO what does the client do with this response, and why is the property
    // called "created"?
    res.json({ created: asPath(userId, boardId.name) });
  } catch (e) {
    next(e);
  }
}

function asGraph(body: unknown): GraphDescriptor | null {
  const graph = body as GraphDescriptor;
  if (!(("nodes" in graph && "edges" in graph) || "main" in graph)) {
    return null;
  }
  return graph;
}

export default post;
