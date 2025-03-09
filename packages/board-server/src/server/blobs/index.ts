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

import { updateFileApiInfo } from "./file-info.js";
import { createBlob } from "./create.js";
import { serveBlob } from "./serve.js";

import { requireAuth } from "../auth.js";
import { isUUID } from "../blob-store.js";
import type { ServerConfig } from "../config.js";
import { corsAll } from "../cors.js";
import { badRequest } from "../errors.js";

export function serveBlobsAPI(config: ServerConfig): Router {
  const router = Router();

  router.use(requireStorageBucket(config));
  router.use(corsAll);

  router.get("/:blobId", (req, res) => get(config, req, res));
  router.post("/", requireAuth(), (req, res) => create(config, req, res));
  router.post("/:blobId/file", (req, res) => update(config, req, res));

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

async function create(
  config: ServerConfig,
  request: Request,
  response: Response
): Promise<void> {
  await createBlob(config, request, response);
}

async function update(
  config: ServerConfig,
  request: Request,
  response: Response
): Promise<void> {
  const blobId = request.params["blobId"] ?? "";
  if (!isUUID(blobId)) {
    badRequest(response, "Invalid blob ID");
    return;
  }
  await updateFileApiInfo(config.storageBucket!, blobId, request, response);
}
