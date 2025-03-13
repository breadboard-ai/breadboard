/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import type { RemoteMessage } from "@google-labs/breadboard/remote";

import { getBody } from "../common.js";
import type { ServerConfig } from "../config.js";
import { secretsKit } from "../proxy/secrets.js";
import { asPath, getStore } from "../store.js";

import { loadFromStore } from "./utils/board-server-provider.js";
import { runBoard, timestamp } from "./utils/run-board.js";
import { verifyKey } from "./utils/verify-key.js";
import type { BoardId } from "../types.js";

async function runHandler(
  config: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  const boardId: BoardId = res.locals.boardId;
  const path = asPath(boardId.user, boardId.name);

  const url = new URL(req.url, config.hostname);
  url.pathname = `boards/${path}`;
  url.search = "";

  const body = await getBody(req);
  const {
    $next: next,
    $diagnostics: diagnostics,
    ...inputs
  } = body as Record<string, any>;
  const writer = new WritableStream<RemoteMessage>({
    write(chunk) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    },
  }).getWriter();
  res.setHeader("Content-Type", "text/event-stream");
  res.statusCode = 200;

  const keyVerificationResult = await verifyKey(
    boardId.user,
    boardId.name,
    inputs
  );
  if (!keyVerificationResult.success) {
    await writer.write([
      "graphstart",
      {
        path: [],
        timestamp: timestamp(),
        graph: { nodes: [], edges: [] },
        graphId: "",
      },
    ]);
    await writer.write([
      "error",
      { error: "Invalid or missing key", code: 403, timestamp: timestamp() },
    ]);
    await writer.write([
      "graphend",
      {
        path: [],
        timestamp: timestamp(),
      },
    ]);
    await writer.close();
    res.end();
    return;
  }

  const runStateStore = getStore();

  await runBoard({
    url: url.href,
    path,
    user: keyVerificationResult.user!,
    inputs,
    loader: loadFromStore,
    kitOverrides: [secretsKit],
    writer,
    next,
    runStateStore,
    diagnostics,
  });
  // await writer.close();
  res.end();
}

export default runHandler;
