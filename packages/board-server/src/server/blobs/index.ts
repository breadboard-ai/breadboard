/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Request, type Response, Router } from "express";

import { ok } from "@google-labs/breadboard";

import { updateFileApiInfo } from "./file-info.js";
import { createBlob } from "./create.js";
import { serveBlob } from "./serve.js";

import { authenticate } from "../auth.js";
import { isUUID } from "../blob-store.js";
import type { ServerConfig } from "../config.js";
import { corsAll } from "../cors.js";
import { badRequest } from "../errors.js";

export function serveBlobsAPI(config: ServerConfig): Router {
  const router = Router();

  router.use(() => checkStorageBucket(config));
  router.use("/", corsAll);

  router.get("/:blobId", (req, res) => get(config, req, res));
  router.post("/", (req, res) => create(config, req, res));
  router.post("/:blobId/file", (req, res) => update(config, req, res));

  return router;
}

function checkStorageBucket(config: ServerConfig) {
  if (!config.storageBucket) {
    throw Error("No storage bucket configured");
  }
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
  const authenticating = await authenticate(request, response);
  if (!ok(authenticating)) {
    return;
  }

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
