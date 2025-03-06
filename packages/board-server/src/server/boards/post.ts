/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { ok, type GraphDescriptor } from "@google-labs/breadboard";

import { authenticateAndGetUserStore } from "../auth.js";
import { badRequest } from "../errors.js";
import { getStore } from "../store.js";
import { getBody } from "../common.js";

import del from "./delete.js";

async function post(req: Request, res: Response): Promise<void> {
  const body = await getBody(req);

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
  const boardPath = res.locals.boardId.fullPath;
  let store;

  const userPath = await authenticateAndGetUserStore(req, res, () => {
    store = getStore();
    return store;
  });
  if (!ok(userPath)) {
    return;
  }

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

  if (!store) {
    store = getStore();
  }

  const result = await store.update(userPath!, boardPath, maybeGraph);
  if (!result.success) {
    badRequest(res, result.error);
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ created: boardPath }));
}

export default post;
