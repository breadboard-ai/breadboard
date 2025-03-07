/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import type { ServerConfig } from "../config.js";
import { secretsKit } from "../proxy/secrets.js";

import { loadFromStore } from "./utils/board-server-provider.js";
import { invokeBoard } from "./utils/invoke-board.js";
import { verifyKey } from "./utils/verify-key.js";

async function invokeHandler(
  config: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  const { user, name, fullPath } = res.locals.boardId;
  const url = new URL(req.url, config.hostname);
  url.pathname = `boards/${fullPath}`;
  url.search = "";

  const inputs = req.body as Record<string, any>;
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
