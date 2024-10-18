/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { getBody } from "../common.js";
import { badRequest, serverError } from "../errors.js";
import { isLLMContent } from "@google-labs/breadboard";
import type { DataPart } from "@breadboard-ai/types";
import { GoogleStorageBlobStore } from "../blob-store.js";
import { getStore } from "../store.js";
import type { ServerConfig } from "../config.js";

export { createBlob };

async function createBlob(
  config: ServerConfig,
  req: IncomingMessage,
  res: ServerResponse
) {
  const body = await getBody(req);
  const { serverUrl, storageBucket } = config;
  if (!body) {
    badRequest(res, "No body provided");
    return;
  }
  if (!isLLMContent(body)) {
    badRequest(
      res,
      JSON.stringify({ error: "Invalid body format. Must be LLM content" })
    );
    return;
  }
  const { parts } = body;
  if (!(parts && parts.length > 0)) {
    badRequest(
      res,
      JSON.stringify("Invalid body format. Must contain at least one part")
    );
    return;
  }

  const store = getStore();
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

  const replacedParts: DataPart[] = [];
  for (const part of parts) {
    if ("inlineData" in part) {
      const result = await blobStore.saveData(part);
      if (!result.success) {
        serverError(res, result.error);
        return;
      }
      replacedParts.push(result.data);
    } else {
      replacedParts.push(part);
    }
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ parts: replacedParts, role: body.role }));
}
