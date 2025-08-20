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
// import { Readable } from "node:stream";
// import { type ReadableStream } from "node:stream/web";
import https from "node:https";
// import { OutgoingHttpHeaders } from "node:http2";
import { GoogleAuth } from "google-auth-library";

// const CACHING_DURATION_MS = 10 * 60 * 1000;
// const ERROR_RETRY_DURATION_MS = 1 * 60 * 1000;
const PRODUCTION_DRIVE_BASE_URL = "https://www.googleapis.com";
// const DRIVE_URL_PREFIX = "drive:/";
// const DOWNLOAD_PARAM = "?alt=media";

// These are copied from
// packages/google-drive-kit/src/board-server/operations.ts
// const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";
// const MIME_TYPE_QUERY = `mimeType="${GRAPH_MIME_TYPE}"`;
// const BASE_FEATURED_QUERY = `
//   ${MIME_TYPE_QUERY}
//   and trashed=false
// `;

// type CachedResponse = {
//   headers: Map<string, string>;
//   body: Buffer;
// };

export type DriveProxyConfig = {
  serverUrl?: string;
  featuredGalleryFolderId?: string;
};

export function makeDriveProxyMiddleware({
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
  //   serverUrl,
  //   featuredGalleryFolderId,
  // };

  // const gallery = new GalleryCache(config);

  const googleAuth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  // const oauthClient = new OAuth2Client();

  async function proxyFetch(
    clientReq: ExpressRequest,
    clientRes: ExpressResponse
  ): Promise<void> {
    // const userAuthHeader = clientReq.headers.authorization;
    // const userTokenMatch = userAuthHeader?.match(/^Bearer (.+)/);
    // if (!userTokenMatch) {
    //   clientRes.writeHead(401);
    //   clientRes.end();
    //   return;
    // }
    // const userToken = userTokenMatch[1];
    // const ticket = await oauthClient.verifyIdToken({
    //   idToken: userToken,
    // });

    const url = new URL(clientReq.url, PRODUCTION_DRIVE_BASE_URL);
    const headers = structuredClone(clientReq.headers);

    // The incoming request "host" header will be the hostname of this proxy
    // server, but it needs to be the hostname of the destination server.
    headers["host"] = url.hostname;

    // Get an authentication token for the
    const authClient = await googleAuth.getClient();
    const token = await authClient.getAccessToken();
    headers["authorization"] = `Bearer ${token.token}`;

    // During local development we are using user credentials, which means we
    // must explicitly set the billing GCP project. Not required in production,
    // but doesn't hurt. See
    // https://cloud.google.com/docs/authentication/rest#set-billing-project
    headers["x-goog-user-project"] = await googleAuth.getProjectId();

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: clientReq.method,
      headers,
    };
    const proxyReq = https.request(options, (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode!, proxyRes.headers);
      proxyRes.pipe(clientRes, { end: true });
    });
    clientReq.pipe(proxyReq, { end: true });
  }

  router.get(
    "/drive/v3/files/:id",
    async (req: ExpressRequest, res: ExpressResponse) => {
      // TODO(aomarks) Intercept requests for featured gallery files, and use
      // the cache.
      proxyFetch(req, res);
    }
  );

  router.get(
    "/drive/v3/files",
    async (req: ExpressRequest, res: ExpressResponse) => {
      // TODO(aomarks) Consider intercepting requests for the featured gallery
      // list query, and use the cache. Though, we need to be careful about the
      // queries being in sync!
      proxyFetch(req, res);
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
