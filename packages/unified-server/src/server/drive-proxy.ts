/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cors from "cors";
import { Router, type Request, type Response } from "express";
import { Readable } from "node:stream";
import { type ReadableStream } from "node:stream/web";

const CACHING_DURATION_MS = 10 * 60 * 1000;
const ERROR_RETRY_DURATION_MS = 1 * 60 * 1000;
const PRODUCTION_DRIVE_BASE_URL = "https://www.googleapis.com";
const DRIVE_URL_PREFIX = "drive:/";
const DOWNLOAD_PARAM = "?alt=media";

// These are copied from
// packages/google-drive-kit/src/board-server/operations.ts
const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";
const DEPRECATED_GRAPH_MIME_TYPE = "application/json";
const MIME_TYPE_QUERY = `(mimeType="${GRAPH_MIME_TYPE}" or mimeType="${DEPRECATED_GRAPH_MIME_TYPE}")`;
const BASE_FEATURED_QUERY = `
  ${MIME_TYPE_QUERY}
  and trashed=false
`;

type CachedResponse = {
  headers: Map<string, string>;
  body: Buffer;
};

export type DriveProxyConfig = {
  publicApiKey?: string;
  serverUrl?: string;
  featuredGalleryFolderId?: string;
};

export function makeDriveProxyMiddleware({
  publicApiKey,
  serverUrl,
  featuredGalleryFolderId,
}: DriveProxyConfig): Router {
  const router = Router();
  router.use(
    cors({
      origin: true,
      credentials: true,
      maxAge: 24 * 60 * 60,
    })
  );
  if (!publicApiKey) {
    router.all(
      "*",
      createErrorHandler("GOOGLE_DRIVE_PUBLIC_API_KEY was not supplied")
    );
    return router;
  }
  if (!serverUrl) {
    router.all("*", createErrorHandler("SERVER_URL was not supplied"));
    return router;
  }
  if (!featuredGalleryFolderId) {
    router.all(
      "*",
      createErrorHandler(
        "GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID was not supplied"
      )
    );
    return router;
  }
  const config = {
    publicApiKey,
    serverUrl,
    featuredGalleryFolderId,
  };

  const gallery = new GalleryCache(config);

  router.get("/:id", async (req: Request, res: Response) => {
    const id = req.params.id;
    try {
      const search = new URL(
        req.originalUrl,
        // This is just to parse as a valid URL (since originalUrl doesn't have a
        // protocol or origin) so we can read search params.
        "https://placeholder.invalid"
      ).search;

      // Only engage caching when this API is requesting media download.
      if (search === DOWNLOAD_PARAM) {
        const cached = gallery.get(id);
        if (cached) {
          res.setHeaders(cached.headers);
          res.send(cached.body);
          return;
        }
      }

      const userResponse = await fetchDriveFile(id, search, config);
      res.status(userResponse.status);
      const headers = getImportantHeaders(userResponse.headers);
      res.setHeaders(headers);
      Readable.fromWeb(userResponse.body as ReadableStream).pipe(res);
    } catch (e) {
      res.status(500).send((e as Error).message);
    }
  });
  return router;
}

function createErrorHandler(message: string) {
  console.warn(`The "/files" API will not be available: ${message}`);
  return async (_req: Request, res: Response) => {
    res.status(404).send(`Unable to serve file: ${message}`);
  };
}

function getImportantHeaders(headers: Headers): Map<string, string> {
  return new Map(
    Array.from(headers.entries()).filter(
      ([name]) => name.toLocaleLowerCase() === "content-type"
    )
  );
}

async function fetchDriveFile(
  id: string,
  search: string,
  config: Readonly<Required<DriveProxyConfig>>
) {
  const productionDriveUrl = new URL(
    `/drive/v3/files/${id}`,
    PRODUCTION_DRIVE_BASE_URL
  );
  if (search) {
    productionDriveUrl.search = search;
  }

  // Now, append the Public API key
  productionDriveUrl.searchParams.set("key", config.publicApiKey);

  return fetch(productionDriveUrl, {
    headers: {
      referer: config.serverUrl,
    },
  });
}

class GalleryCache {
  #status: "ready" | "reloading" | "error" = "reloading";
  #expiresAt: number = Date.now();
  #cache = new Map<string, CachedResponse>();

  constructor(public readonly config: Readonly<Required<DriveProxyConfig>>) {
    this.#reload();
  }

  async #readGalleryList(): Promise<undefined | string[]> {
    const url = new URL(`drive/v3/files`, PRODUCTION_DRIVE_BASE_URL);
    const fields = ["id", "properties"];
    const query = `"${this.config.featuredGalleryFolderId}" in parents and ${BASE_FEATURED_QUERY}`;

    url.searchParams.set("q", query);
    url.searchParams.set("fields", `files(${fields.join(",")})`);
    url.searchParams.set("key", this.config.publicApiKey);
    try {
      const response = await fetch(url, {
        headers: {
          referer: this.config.serverUrl,
        },
      });
      if (!response.ok) return;
      const listResponse = (await response.json()) as {
        files: {
          id: string;
          properties: {
            thumbnailUrl: string;
          };
        }[];
      };
      const ids = new Set<string>();
      listResponse.files.forEach(({ id, properties }) => {
        ids.add(id);
        const thumbnailUrl = properties.thumbnailUrl;
        if (thumbnailUrl?.startsWith(DRIVE_URL_PREFIX)) {
          ids.add(thumbnailUrl.slice(DRIVE_URL_PREFIX.length));
        }
      });
      return Array.from(ids.values());
    } catch {
      // Swallow the error here. We will fail silently.
      return;
    }
  }

  async #cacheFile(
    id: string
  ): Promise<[id: string, value: CachedResponse] | undefined> {
    try {
      const response = await fetchDriveFile(id, DOWNLOAD_PARAM, this.config);
      if (!response.ok) return;
      console.log("RESPONSE STATUS", response.status);
      const headers = getImportantHeaders(response.headers);
      const arrayBuffer = await response.arrayBuffer();
      return [
        id,
        {
          body: Buffer.from(arrayBuffer),
          headers,
        },
      ];
    } catch {
      // Swallow the error here. We will fail silently
      return;
    }
  }

  get(id: string): CachedResponse | undefined {
    if (this.#status === "reloading") return;

    if (Date.now() > this.#expiresAt) {
      // Trigger reload ...
      this.#reload();
      // ... and fall through to use stale values.
    }
    // Try serving stale results when in "error" status
    return this.#cache.get(id);
  }

  async #reload() {
    this.#status = "reloading";

    const list = await this.#readGalleryList();
    console.log("LIST", list);
    if (!list) {
      this.#status = "error";
      this.#expiresAt = Date.now() + ERROR_RETRY_DURATION_MS;
      return;
    }

    try {
      const cachedValues = await Promise.all(
        list.map((id) => {
          return this.#cacheFile(id);
        })
      );
      this.#cache = new Map(cachedValues.filter((item) => !!item));
      if (this.#cache.size === 0) {
        // Treat not being able to load any of the files as an error
        this.#status = "error";
        this.#expiresAt = Date.now() + ERROR_RETRY_DURATION_MS;
        return;
      }

      this.#status = "ready";
      this.#expiresAt = Date.now() + CACHING_DURATION_MS;
    } catch {
      // Swallow the error. We will fail silently.
      this.#status = "error";
      this.#expiresAt = Date.now() + ERROR_RETRY_DURATION_MS;
    }
  }
}
