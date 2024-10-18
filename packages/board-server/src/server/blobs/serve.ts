/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { GoogleStorageBlobStore } from "../blob-store.js";

export { serveBlob };

async function serveBlob(
  bucketId: string,
  blobId: string,
  _req: IncomingMessage,
  res: ServerResponse
) {
  const store = new GoogleStorageBlobStore(bucketId);
  const result = await store.getBlob(blobId);
  if (result.success) {
    res.writeHead(200, {
      "Content-Type": result.mimeType || "application/octet-stream",
      "content-disposition": "inline",
    });
    res.end(result.data);
  }
  return true;
}
