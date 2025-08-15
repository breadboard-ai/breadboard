/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { GoogleStorageBlobStore } from "../blob-store.js";
import { ok } from "@google-labs/breadboard";

export { serveBlob };

async function serveBlob(
  bucketId: string,
  blobId: string,
  _req: IncomingMessage,
  res: ServerResponse
) {
  const store = new GoogleStorageBlobStore(bucketId);
  const result = await store.getBlob(blobId);
  if (ok(result)) {
    res.writeHead(200, {
      "Content-Type": result.mimeType || "application/octet-stream",
      "content-disposition": "inline",
    });
    res.end(result.data);
  } else {
    res.statusCode = 500;
    res.end(result.$error);
  }
}
