/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response } from "express";

import { loadFromStore } from "./utils/board-server-provider.js";
import { verifyKey } from "./utils/verify-key.js";
import { secretsKit } from "../proxy/secrets.js";
import { invokeBoard } from "./utils/invoke-board.js";

async function invokeHandler(
  url: URL,
  res: Response,
  body: unknown
): Promise<void> {
  const { user, name, fullPath } = res.locals.boardId;
  const inputs = body as Record<string, any>;
  const keyVerificationResult = await verifyKey(user, name, inputs);
  if (!keyVerificationResult.success) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ $error: keyVerificationResult.error }));
    return;
  }
  const result = await invokeBoard({
    url: url.href,
    path: fullPath,
    inputs,
    loader: loadFromStore,
    kitOverrides: [secretsKit],
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}

export default invokeHandler;
