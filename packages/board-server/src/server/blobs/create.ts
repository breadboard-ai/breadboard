/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { getBody } from "../common.js";
import { badRequest } from "../errors.js";
import { isLLMContent } from "@google-labs/breadboard";

export { createBlob };

async function createBlob(req: IncomingMessage, res: ServerResponse) {
  const body = await getBody(req);
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
  const blobs = parts
    .filter((part) => "inlineData" in part)
    .map((part) => part.inlineData);
  if (blobs.length === 0) {
    badRequest(
      res,
      JSON.stringify(
        "Invalid body format. Must contain at least one `inlineData` part"
      )
    );
  }
  // Store blobs in the bucket.
  // Return unique id for each Blob, in the same order as they were received.

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ blobs }));
}
