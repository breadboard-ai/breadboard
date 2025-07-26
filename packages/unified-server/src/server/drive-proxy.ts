/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cors from "cors";
import { Router, type Request, type Response } from "express";
import { Readable } from "node:stream";
import { type ReadableStream } from "node:stream/web";

const PRODUCTION_DRIVE_BASE_URL = "https://www.googleapis.com";

export type DriveProxyConfig = {
  publicApiKey: string;
  serverUrl: string;
};

export function makeDriveProxyMiddleware({
  publicApiKey,
  serverUrl,
}: DriveProxyConfig) {
  const router = Router();
  router.use(
    cors({
      origin: true,
      credentials: true,
      maxAge: 24 * 60 * 60,
    })
  );
  router.get("/:id", async (req: Request, res: Response) => {
    const productionDriveUrl = new URL(
      `/drive/v3/files${req.path}`,
      PRODUCTION_DRIVE_BASE_URL
    );
    productionDriveUrl.search = new URL(
      req.originalUrl,
      // This is just to parse as a valid URL (since originalUrl doesn't have a
      // protocol or origin) so we can read search params.
      "https://placeholder.invalid"
    ).search;

    // Now, append the Public API key
    productionDriveUrl.searchParams.set("key", publicApiKey);

    const userResponse = await fetch(productionDriveUrl, {
      headers: {
        referer: serverUrl,
      },
    });
    res.status(userResponse.status);
    Readable.fromWeb(userResponse.body as ReadableStream).pipe(res);
  });
  return router;
}
