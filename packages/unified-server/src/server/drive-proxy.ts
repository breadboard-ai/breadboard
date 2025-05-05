/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cors from "cors";
import { Router, type Request, type Response } from "express";
import { GoogleAuth } from "google-auth-library";
import { Readable } from "node:stream";
import { type ReadableStream } from "node:stream/web";

const PRODUCTION_DRIVE_BASE_URL = "https://www.googleapis.com";

export function makeDriveProxyMiddleware() {
  const router = Router();
  router.use(
    cors({
      origin: true,
      credentials: true,
      maxAge: 24 * 60 * 60,
    })
  );
  router.all("*", handler);
  return router;
}

async function handler(req: Request, res: Response) {
  if (
    !(req.path === "/drive/v3/files" || req.path.startsWith("/drive/v3/files/"))
  ) {
    res.sendStatus(403);
    return;
  }

  const userAuthHeader = req.headers.authorization;
  if (!userAuthHeader) {
    res.sendStatus(401);
    return;
  }

  const productionDriveUrl = new URL(req.path, PRODUCTION_DRIVE_BASE_URL);
  productionDriveUrl.search = new URL(
    req.originalUrl,
    // This is just to parse as a valid URL (since originalUrl doesn't have a
    // protocol or origin) so we can read search params.
    "https://placeholder.invalid"
  ).search;

  // First try with user credentials.
  const userResponse = await fetch(productionDriveUrl, {
    method: req.method,
    headers: { authorization: userAuthHeader },
  });
  // TODO(aomarks) Checking for 404 won't suffice for a listing query, since
  // that will just return empty/partial results when a public file is missing.
  if (userResponse.status !== 404) {
    res.status(userResponse.status);
    Readable.fromWeb(userResponse.body as ReadableStream).pipe(res);
    return;
  }

  // Failing that, try reading it as a public file using our service account
  // credentials.
  //
  // TODO(aomarks) We should probably explicitly check permissions and only
  // return files that are definitely public, since otherwise any file shared
  // only with our service account would be readable by anyone.
  const serviceAuth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const serviceAuthClient = await serviceAuth.getClient();
  const serviceToken = await serviceAuthClient.getAccessToken();
  const serviceResponse = await fetch(productionDriveUrl, {
    headers: { authorization: `Bearer ${serviceToken}` },
  });
  res.status(serviceResponse.status);
  Readable.fromWeb(serviceResponse.body as ReadableStream).pipe(res);
}
