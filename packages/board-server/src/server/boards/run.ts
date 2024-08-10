/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ApiHandler, BoardParseResult } from "../types.js";
import { loadFromStore } from "./utils/board-server-provider.js";
import { verifyKey } from "./utils/verify-key.js";
import { secretsKit } from "../proxy/secrets.js";
import { runBoard } from "./utils/run-board.js";
import { getStore } from "../store.js";
import type { RemoteMessage } from "@google-labs/breadboard/remote";

const runHandler: ApiHandler = async (parsed, req, res, body) => {
  const { board, url } = parsed as BoardParseResult;
  const { $next: next, ...inputs } = body as Record<string, any>;
  const keyVerificationResult = await verifyKey(inputs);
  if (!keyVerificationResult.success) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ $error: keyVerificationResult.error }));
    return true;
  }
  const writer = new WritableStream<RemoteMessage>({
    write(chunk) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    },
  }).getWriter();

  const runStateStore = getStore();

  res.setHeader("Content-Type", "text/event-stream");
  res.statusCode = 200;
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
  });
  writer.close();
  res.end();
  return true;
};

export default runHandler;
