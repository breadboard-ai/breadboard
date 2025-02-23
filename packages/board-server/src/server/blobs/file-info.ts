/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { notFound, serverError } from "../errors.js";
import { GoogleStorageBlobStore } from "../blob-store.js";
import { ok } from "@google-labs/breadboard";
import { GeminiFileApi } from "./utils/gemini-file-api.js";

export { updateFileApiInfo };

async function updateFileApiInfo(
  bucketId: string,
  blobId: string,
  _req: IncomingMessage,
  res: ServerResponse
) {
  const store = new GoogleStorageBlobStore(bucketId);
  const gettingMetadata = await store.getMetadata(blobId);
  if (!ok(gettingMetadata)) {
    notFound(res, `Blob "${blobId} not found`);
    return true;
  }

  const { fileUri, expirationTime } = gettingMetadata;
  const expired = hasExpired(expirationTime);
  if (fileUri && !expired) {
    res.writeHead(200, {
      "Content-Type": "application/json",
    });
    res.end({ fileUri });
    return true;
  }

  const fileApi = new GeminiFileApi();

  const uploading = await fileApi.upload(await store.getReadableStream(blobId));
  if (!ok(uploading)) {
    serverError(res, `Unable to create File API entry from blob "${blobId}`);
    return true;
  }

  const updating = await store.setMetadata(blobId, uploading);
  if (!ok(updating)) {
    serverError(res, `Unable to set File API metadata for blob "${blobId}`);
    return true;
  }

  res.writeHead(200, {
    "Content-Type": "application/json",
  });
  res.end(uploading);
  return true;
}

function hasExpired(expirationTime?: string) {
  if (!expirationTime) return true;
  const expiresOn = new Date(expirationTime).getTime();
  return expiresOn > Date.now();
}
