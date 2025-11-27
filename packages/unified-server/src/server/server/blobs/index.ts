/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
  Router,
} from "express";

import { serveBlob } from "./serve.js";

import { isUUID } from "../blob-store.js";
import type { ServerConfig } from "../config.js";
import { badRequest } from "../errors.js";

export function serveBlobsAPI(config: ServerConfig): Router {
  const router = Router();

  router.use(requireStorageBucket(config));

  router.get("/:blobId", (req, res) => get(config, req, res));

  return router;
}

function requireStorageBucket(config: ServerConfig): RequestHandler {
  return (_req: Request, _res: Response, next: NextFunction) => {
    if (!config.storageBucket) {
      throw Error("No storage bucket configured");
    }
    next();
  };
}

async function get(
  config: ServerConfig,
  request: Request,
  response: Response
): Promise<void> {
  const blobId = request.params["blobId"] ?? "";
  if (!isUUID(blobId)) {
    badRequest(response, "Invalid blob ID");
    return;
  }

  await serveBlob(config.storageBucket!, blobId, request, response);
}
