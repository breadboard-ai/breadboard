/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cors from "cors";
import { Router, type Request, type Response } from "express";
import { Readable, PassThrough } from "node:stream";
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
    const id = req.path;
    const cached = DriveStoreCache.instance.get(id);
    if (cached) {
      res.setHeaders(cached.headers);
      res.send(cached.body);
      return;
    }

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
    res.setHeaders(new Map(userResponse.headers.entries()));
    Readable.fromWeb(userResponse.body as ReadableStream)
      .pipe(
        DriveStoreCache.instance.store(
          userResponse.status,
          userResponse.headers,
          id
        )
      )
      .pipe(res);
  });
  return router;
}

type CachedResponse = {
  headers: Map<string, string>;
  body: Buffer;
};

class DriveStoreCache {
  readonly #cache = new Map<string, CachedResponse>();

  private constructor() {}

  get(id: string): CachedResponse | undefined {
    return this.#cache.get(id);
  }

  store(status: number, responseHeaders: Headers, id: string): PassThrough {
    const chunks: Buffer[] = [];
    const passthrough = new PassThrough();
    passthrough.on("data", (chunk) => {
      chunks.push(chunk);
    });
    passthrough.on("end", () => {
      const body = Buffer.concat(chunks);
      const headers = new Map(responseHeaders.entries());
      // Only cache successful results
      if (status === 200) {
        this.#cache.set(id, { headers, body });
      }
    });
    return passthrough;
  }

  static readonly instance = new DriveStoreCache();
}
