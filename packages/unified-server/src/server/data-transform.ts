/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { requireAccessToken } from "@breadboard-ai/board-server";
import cors from "cors";
import { Router } from "express";

export { createDataTransformHandler };

function createDataTransformHandler(bucketId: string | undefined) {
  const router = Router();
  router.use(
    cors({
      origin: true,
      credentials: true,
      maxAge: 24 * 60 * 60,
    })
  );
  router.get("/bucket", requireAccessToken(), async (req, res) => {
    if (!bucketId) {
      res.status(500).json({ $error: "Bucket name is not configured" });
      return;
    }
    res.status(200).json({ bucketId });
  });
  return router;
}
