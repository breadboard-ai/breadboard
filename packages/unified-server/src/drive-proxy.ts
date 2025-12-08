/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import compression from "compression";
import cors from "cors";
import {
  Router,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from "express";
import { GoogleAuth } from "google-auth-library";
import { Buffer } from "node:buffer";
import { type IncomingHttpHeaders, type OutgoingHttpHeaders } from "node:http";
import https from "node:https";
import * as zlib from "node:zlib";

const PRODUCTION_DRIVE_BASE_URL = "https://www.googleapis.com";

export interface MakeDriveProxyMiddlewareInit {
  shouldCacheMedia: (fileId: string) => boolean;
  mediaCacheMaxAgeSeconds: number;
}

export function makeDriveProxyMiddleware({
  shouldCacheMedia,
  mediaCacheMaxAgeSeconds,
}: MakeDriveProxyMiddlewareInit): Router {
  const router = Router();
  router.use(
    cors({
      origin: true,
      credentials: true,
      maxAge: 24 * 60 * 60,
    })
  );

  // This will use Application Default Credentials. See
  // https://cloud.google.com/docs/authentication/application-default-credentials.
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  async function makeProxyRequestOptions(
    clientReq: ExpressRequest,
    headers?: Record<string, string | string[] | number>
  ): Promise<https.RequestOptions> {
    const url = new URL(clientReq.url, PRODUCTION_DRIVE_BASE_URL);
    headers = headers ? structuredClone(headers) : {};

    // The incoming request "host" header will be the hostname of this proxy
    // server, but it needs to be the hostname of the destination server.
    headers["host"] = url.hostname;

    const authClient = await auth.getClient();
    const token = await authClient.getAccessToken();
    headers["authorization"] = `Bearer ${token.token}`;

    // During local development we might be using user credentials instead of a
    // service account, which means we must explicitly set the billing GCP
    // project. Not required in production, but doesn't hurt. See
    // https://cloud.google.com/docs/authentication/rest#set-billing-project
    headers["x-goog-user-project"] = await auth.getProjectId();

    return {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: clientReq.method,
      headers,
    };
  }

  async function proxyDirectly(
    clientReq: ExpressRequest,
    clientRes: ExpressResponse
  ): Promise<void> {
    const options = await makeProxyRequestOptions(
      clientReq,
      allowlistHeaders(clientReq.headers, ["accept", "accept-encoding"])
    );
    const proxyReq = https.request(options, (proxyRes) => {
      // TODO(aomarks) Should we filter out some headers here?
      clientRes.writeHead(proxyRes.statusCode!, proxyRes.headers);
      proxyRes.pipe(clientRes, { end: true });
    });
    clientReq.pipe(proxyReq, { end: true });
  }

  type CacheEntry = {
    timestampMillis: number;
    responsePromise: Promise<{
      status: number;
      headers: IncomingHttpHeaders;
      body: Buffer;
    }>;
  };
  const cache = new Map<string, CacheEntry>();

  async function proxyWithCaching(
    clientReq: ExpressRequest,
    clientRes: ExpressResponse,
    cacheKey: string
  ): Promise<void> {
    let entry = cache.get(cacheKey);
    if (
      !entry ||
      Date.now() - entry.timestampMillis > mediaCacheMaxAgeSeconds * 1000
    ) {
      entry = {
        timestampMillis: Date.now(),
        responsePromise: sendProxyWithCachingRequest(clientReq),
      };
      cache.set(cacheKey, entry);
    }
    const { status, headers, body } = await entry.responsePromise;
    // TODO(aomarks) Should we filter out some headers here?
    clientRes.writeHead(status, headers);
    clientRes.end(body);
  }

  async function sendProxyWithCachingRequest(
    clientReq: ExpressRequest
  ): CacheEntry["responsePromise"] {
    const options = await makeProxyRequestOptions(clientReq, {
      // It doesn't matter what the initiating client request's accept-encoding
      // header was, because we want to store the response uncompressed, so that
      // we can re-compress it for future client requests, which each might have
      // a different accept-encoding header.
      "accept-encoding": "gzip",
    });
    return await new Promise((resolve) => {
      const proxyReq = https.request(options, (rawProxyRes) => {
        const uncompressedProxyRes =
          rawProxyRes.headers["content-encoding"] === "gzip"
            ? rawProxyRes.pipe(zlib.createGunzip())
            : // It's either gzip or uncompressed, because of the above
              // accept-encoding header. Note that Drive might send uncompressed
              // for data that is intrinsically compressed, like image/png.
              rawProxyRes;
        const chunks: Buffer[] = [];
        uncompressedProxyRes.on("data", (chunk) =>
          chunks.push(chunk as Buffer)
        );
        uncompressedProxyRes.on("end", () => {
          const headers = rawProxyRes.headers;
          delete headers["content-encoding"];
          resolve({
            status: rawProxyRes.statusCode!,
            headers,
            body: Buffer.concat(chunks),
          });
        });
      });
      clientReq.pipe(proxyReq, { end: true });
    });
  }

  // Use https://expressjs.com/en/resources/middleware/compression.html so that
  // cached responses get compressed.
  router.use(compression());

  // We only support a subset of the Drive APIs in this proxy. That's because
  // it's only designed to be used for these use cases:
  //
  // [1] Signed-out users reading any public graph or asset, because they don't
  // have any credentials of their own to use.
  //
  // [2] Signed-in users reading public featured gallery graphs and assets,
  // because that allows us to cache those heavily-accessed files on this FE
  // server, which keeps the drive egress quota utilization down on them.

  // Get file metadata or media.
  router.get(
    "/drive/v3/files/:id",
    async (req: ExpressRequest, res: ExpressResponse) => {
      const fileId = req.params["id"];
      if (isMediaRequest(req) && shouldCacheMedia(fileId)) {
        proxyWithCaching(req, res, `media:${fileId}`);
      } else {
        proxyDirectly(req, res);
      }
    }
  );

  // List files.
  router.get(
    "/drive/v3/files",
    async (req: ExpressRequest, res: ExpressResponse) => {
      proxyDirectly(req, res);
    }
  );

  // Any path or method not matched by the rules above.
  router.all("*", async (req: ExpressRequest, res: ExpressResponse) => {
    const code = 403;
    const message =
      `This kind of request is not supported by the drive proxy.` +
      ` The user may need to be signed-in for this operation.`;
    res.writeHead(code, { "content-type": "application/json" });
    res.end(
      JSON.stringify(
        // Note this error response format is intended to look like
        // https://cloud.google.com/resource-manager/docs/core_errors (or at
        // least a subset of that) so that error handling on the client can be
        // consistent with actual drive errors.
        { error: { code, message } }
      )
    );
  });

  return router;
}

const isMediaRequest = (req: ExpressRequest) =>
  new URL(req.url, "http://example.com").searchParams.get("alt") === "media";

const allowlistHeaders = (
  source: IncomingHttpHeaders | OutgoingHttpHeaders,
  include: string[]
): Record<string, string | string[] | number> => {
  const headers: Record<string, string | string[] | number> = {};
  for (const name of include) {
    const value = source[name];
    if (value) {
      headers[name] = value;
    }
  }
  return headers;
};
