/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { isLLMContent, ok } from "@google-labs/breadboard";
import type { LLMContent } from "@breadboard-ai/types";

import { GoogleStorageBlobStore } from "../blob-store.js";
import type { ServerConfig } from "../config.js";
import { badRequest, serverError } from "../errors.js";
import type { BoardServerStore } from "../store.js";

export { createBlob };

async function createBlob(config: ServerConfig, req: Request, res: Response) {
  const store: BoardServerStore = req.app.locals.store;

  const { serverUrl, storageBucket } = config;
  if (!isLLMContent(req.body)) {
    badRequest(
      res,
      JSON.stringify({ error: "Invalid body format. Must be LLM content" })
    );
    return;
  }
  const { parts } = req.body;
  if (!(parts && parts.length > 0)) {
    badRequest(
      res,
      JSON.stringify("Invalid body format. Must contain at least one part")
    );
    return;
  }

  let url = serverUrl;
  if (!url) {
    const serverInfo = await store.getServerInfo();
    if (!serverInfo || !serverInfo.url) {
      serverError(res, "Unable to get server info or server URL.");
      return;
    }
    url = serverInfo.url;
  }
  const blobStore = new GoogleStorageBlobStore(storageBucket!, url);

  const result = await blobStore.deflateContent(req.body as LLMContent);
  if (!ok(result)) {
    serverError(res, result.$error);
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}
