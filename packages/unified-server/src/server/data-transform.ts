/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GeminiFileApi,
  GoogleStorageBlobStore,
  requireAccessToken,
} from "@breadboard-ai/board-server";
import { ok } from "@breadboard-ai/utils";
import cors from "cors";
import { Router } from "express";
import { Readable } from "node:stream";

export { createDataTransformHandler };

function createDataTransformHandler(
  bucketId: string | undefined,
  serverUrl: string | undefined
) {
  const router = Router();
  router.use(
    cors({
      origin: true,
      credentials: true,
      maxAge: 24 * 60 * 60,
    })
  );
  router.get("/bucket", requireAccessToken(), async (_req, res) => {
    if (!bucketId) {
      res.status(500).json({ $error: "Bucket name is not configured" });
      return;
    }
    res.status(200).json({ bucketId });
  });
  router.post("/blob/:blobId", requireAccessToken(), async (req, res) => {
    if (!bucketId) {
      res.status(500).json({ $error: "Bucket name is not configured" });
      return;
    }
    const blobId = req.params["blobId"];
    if (!blobId) {
      res.status(500).json({ $error: "Invalid request: blobId is required" });
    }
    const blobStore = new GoogleStorageBlobStore(bucketId, serverUrl);
    const blob = await blobStore.getBlob(blobId);
    if (!ok(blob)) {
      res.status(500).json(blob);
      return;
    }
    const mimeType = blob.mimeType!;
    const geminiFileApi = new GeminiFileApi();
    const readable = Readable.from(blob.data);
    const uploading = await geminiFileApi.upload(
      blob.data.length,
      mimeType,
      blobId,
      readable
    );
    if (!ok(uploading)) {
      res.status(500).json(uploading);
      return;
    }
    const { fileUri } = uploading;
    res
      .json({
        part: {
          fileData: { fileUri, mimeType },
        },
      })
      .end();
  });
  return router;
}
