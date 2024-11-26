/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ApiHandler, BoardParseResult } from "../types.js";
import { loadFromStore } from "./utils/board-server-provider.js";
import { verifyKey } from "./utils/verify-key.js";
import { secretsKit } from "../proxy/secrets.js";
import { runBoard, timestamp } from "./utils/run-board.js";
import { getStore } from "../store.js";
import type { RemoteMessage } from "@google-labs/breadboard/remote";

const runHandler: ApiHandler = async (parsed, req, res, body) => {
  const { board, url, name, user } = parsed as BoardParseResult;
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

  const keyVerificationResult = await verifyKey(user, name, inputs);
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
    return true;
  }

  const runStateStore = getStore();

  await runBoard({
    url,
    path: board,
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
  return true;
};

export default runHandler;
