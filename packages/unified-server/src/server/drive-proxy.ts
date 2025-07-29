/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cors from "cors";
import {
  Router,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from "express";
import { Readable } from "node:stream";
import { type ReadableStream } from "node:stream/web";

// const CACHING_DURATION_MS = 10 * 60 * 1000;
// const ERROR_RETRY_DURATION_MS = 1 * 60 * 1000;
const PRODUCTION_DRIVE_BASE_URL = "https://www.googleapis.com";
// const DRIVE_URL_PREFIX = "drive:/";
// const DOWNLOAD_PARAM = "?alt=media";

// These are copied from
// packages/google-drive-kit/src/board-server/operations.ts
// const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";
// const DEPRECATED_GRAPH_MIME_TYPE = "application/json";
// const MIME_TYPE_QUERY = `(mimeType="${GRAPH_MIME_TYPE}" or mimeType="${DEPRECATED_GRAPH_MIME_TYPE}")`;
// const BASE_FEATURED_QUERY = `
//   ${MIME_TYPE_QUERY}
//   and trashed=false
// `;

// type CachedResponse = {
//   headers: Map<string, string>;
//   body: Buffer;
// };

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
  // const config = {
  //   publicApiKey,
  //   serverUrl,
  //   featuredGalleryFolderId,
  // };

  // const gallery = new GalleryCache(config);

  async function proxyFetch(req: ExpressRequest): Promise<Response> {
    const url = new URL(req.url, PRODUCTION_DRIVE_BASE_URL);
    const headers = new Headers(req.headers as Record<string, string>);
    // TODO(aomarks) Can we use service account credentials here instead of an
    // API key?
    headers.delete("authorization");
    headers.set("x-goog-api-key", publicApiKey!);
    return fetch(url, { method: req.method, headers });
  }

  router.get(
    "/drive/v3/files/:id",
    async (req: ExpressRequest, res: ExpressResponse) => {
      const response = await proxyFetch(req);
      res.status(response.status);
      res.setHeaders(response.headers);
      Readable.fromWeb(response.body as ReadableStream).pipe(res);
    }
  );

  router.get(
    "/drive/v3/files",
    async (req: ExpressRequest, res: ExpressResponse) => {
      const response = await proxyFetch(req);
      res.status(response.status);
      res.setHeaders(response.headers);
      Readable.fromWeb(response.body as ReadableStream).pipe(res);
    }
  );

  return router;
}

function createErrorHandler(message: string) {
  console.warn(`The "/files" API will not be available: ${message}`);
  return async (_req: ExpressRequest, res: ExpressResponse) => {
    res.status(404).send(`Unable to serve file: ${message}`);
  };
}

// function getImportantHeaders(headers: Headers): Map<string, string> {
//   return new Map(
//     Array.from(headers.entries()).filter(
//       ([name]) => name.toLocaleLowerCase() === "content-type"
//     )
//   );
// }

// async function fetchDriveFile(
//   id: string,
//   search: string,
//   config: Readonly<Required<DriveProxyConfig>>
// ) {
//   const productionDriveUrl = new URL(
//     `/drive/v3/files/${id}`,
//     PRODUCTION_DRIVE_BASE_URL
//   );
//   if (search) {
//     productionDriveUrl.search = search;
//   }

//   // Now, append the Public API key
//   productionDriveUrl.searchParams.set("key", config.publicApiKey);

//   return fetch(productionDriveUrl, {
//     headers: {
//       referer: config.serverUrl,
//     },
//   });
// }

// class GalleryCache {
//   #status: "ready" | "reloading" | "error" = "reloading";
//   #expiresAt: number = Date.now();
//   #cache = new Map<string, CachedResponse>();

//   constructor(public readonly config: Readonly<Required<DriveProxyConfig>>) {
//     this.#reload();
//   }

//   async #readGalleryList(): Promise<undefined | string[]> {
//     const url = new URL(`drive/v3/files`, PRODUCTION_DRIVE_BASE_URL);
//     const fields = ["id", "properties"];
//     const query = `"${this.config.featuredGalleryFolderId}" in parents and ${BASE_FEATURED_QUERY}`;

//     url.searchParams.set("q", query);
//     url.searchParams.set("fields", `files(${fields.join(",")})`);
//     url.searchParams.set("key", this.config.publicApiKey);
//     try {
//       const response = await fetch(url, {
//         headers: {
//           referer: this.config.serverUrl,
//         },
//       });
//       if (!response.ok) {
//         console.warn(
//           `Failed to read gallery list: got ${response.status} response`
//         );
//         return;
//       }
//       const listResponse = (await response.json()) as {
//         files: {
//           id: string;
//           properties: {
//             thumbnailUrl: string;
//           };
//         }[];
//       };
//       const ids = new Set<string>();
//       listResponse.files.forEach(({ id, properties }) => {
//         ids.add(id);
//         const thumbnailUrl = properties.thumbnailUrl;
//         if (thumbnailUrl?.startsWith(DRIVE_URL_PREFIX)) {
//           ids.add(thumbnailUrl.slice(DRIVE_URL_PREFIX.length));
//         }
//       });
//       return Array.from(ids.values());
//     } catch (e) {
//       console.warn("Failed to read gallery list", (e as Error).message);
//     }
//   }

//   async #cacheFile(
//     id: string
//   ): Promise<[id: string, value: CachedResponse] | undefined> {
//     try {
//       const response = await fetchDriveFile(id, DOWNLOAD_PARAM, this.config);
//       if (!response.ok) {
//         console.warn(
//           `Failed to get drive file: got ${response.status} response`
//         );
//         return;
//       }
//       const headers = getImportantHeaders(response.headers);
//       const arrayBuffer = await response.arrayBuffer();
//       return [
//         id,
//         {
//           body: Buffer.from(arrayBuffer),
//           headers,
//         },
//       ];
//     } catch (e) {
//       console.warn("Failed to read gallery list", (e as Error).message);
//     }
//   }

//   get(id: string): CachedResponse | undefined {
//     if (this.#status === "reloading") return;

//     if (Date.now() > this.#expiresAt) {
//       // Trigger reload ...
//       this.#reload();
//       // ... and fall through to use stale values.
//     }
//     // Try serving stale results when in "error" status
//     return this.#cache.get(id);
//   }

//   async #reload() {
//     this.#status = "reloading";

//     const list = await this.#readGalleryList();
//     if (!list) {
//       this.#status = "error";
//       this.#expiresAt = Date.now() + ERROR_RETRY_DURATION_MS;
//       return;
//     }

//     try {
//       const cachedValues = await Promise.all(
//         list.map((id) => {
//           return this.#cacheFile(id);
//         })
//       );
//       this.#cache = new Map(cachedValues.filter((item) => !!item));
//       if (this.#cache.size === 0) {
//         // Treat not being able to load any of the files as an error.
//         console.warn(
//           `Failed to reload cache: unable to load any of gallery files`
//         );
//         this.#status = "error";
//         this.#expiresAt = Date.now() + ERROR_RETRY_DURATION_MS;
//         return;
//       }

//       this.#status = "ready";
//       this.#expiresAt = Date.now() + CACHING_DURATION_MS;
//     } catch (e) {
//       console.warn(`Failed to reload cache`, (e as Error).message);
//       this.#status = "error";
//       this.#expiresAt = Date.now() + ERROR_RETRY_DURATION_MS;
//     }
//   }
// }
