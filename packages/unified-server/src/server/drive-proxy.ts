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
import { GoogleAuth } from "google-auth-library";
import https from "node:https";

const PRODUCTION_DRIVE_BASE_URL = "https://www.googleapis.com";

export function makeDriveProxyMiddleware(): Router {
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

  async function proxyFetch(
    clientReq: ExpressRequest,
    clientRes: ExpressResponse
  ): Promise<void> {
    const url = new URL(clientReq.url, PRODUCTION_DRIVE_BASE_URL);
    const headers = structuredClone(clientReq.headers);

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

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: clientReq.method,
      headers,
    };

    // Stream the request in and the response out.
    const proxyReq = https.request(options, (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode!, proxyRes.headers);
      proxyRes.pipe(clientRes, { end: true });
    });
    clientReq.pipe(proxyReq, { end: true });
  }

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
      proxyFetch(req, res);
    }
  );

  // List files.
  router.get(
    "/drive/v3/files",
    async (req: ExpressRequest, res: ExpressResponse) => {
      proxyFetch(req, res);
    }
  );

  // Any path or method not matched by the rules above.
  router.all("*", async (req: ExpressRequest, res: ExpressResponse) => {
    const code = 403;
    const message =
      `This kind of request is not supported by the signed-out drive proxy.` +
      ` The user should probably be signed-in for this operation.`;
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
