/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import cors from "cors";
import {
  Router,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
  type RequestHandler,
} from "express";
import { makeGraphListQuery } from "@breadboard-ai/google-drive-kit/board-server/operations.js";

export interface GalleryMiddlewareInit {
  folderId: string;
  driveClient: GoogleDriveClient;
  cacheRefreshSeconds: number;
}

export async function makeGalleryMiddleware({
  folderId,
  driveClient,
  cacheRefreshSeconds,
}: GalleryMiddlewareInit): Promise<RequestHandler> {
  if (!folderId) {
    throw new Error("No folder id provided");
  }
  if (cacheRefreshSeconds <= 0) {
    throw new Error("Cache refresh seconds must be > 0");
  }

  const listQuery = makeGraphListQuery({
    kind: "shareable",
    owner: undefined,
    parent: folderId,
  });
  let cachedListJson: string;
  async function refreshCache() {
    const result = await driveClient.listFiles(listQuery, {
      fields: ["id", "name", "properties"],
    });
    cachedListJson = JSON.stringify(result.files, null, 2);
    console.log(
      `[gallery middleware] refreshed cache with ${result.files.length} graphs.`
    );
  }
  await refreshCache();
  setInterval(() => refreshCache(), cacheRefreshSeconds * 1000);

  const router = Router();
  router.use(cors({ origin: true, credentials: true, maxAge: 24 * 60 * 60 }));

  router.get("/list", async (_: ExpressRequest, res: ExpressResponse) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(cachedListJson);
  });

  return router;
}
