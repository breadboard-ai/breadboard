/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { ok } from "@google-labs/breadboard";

import { updateFileApiInfo } from "./file-info.js";
import { createBlob } from "./create.js";
import { serveBlob } from "./serve.js";

import { authenticate } from "../auth.js";
import { isUUID } from "../blob-store.js";
import type { ServerConfig } from "../config.js";
import { corsAll } from "../cors.js";
import { badRequest } from "../errors.js";

export async function get(
  config: ServerConfig,
  request: Request,
  response: Response
) {
  const blobId = request.params["blobId"] ?? "";
  if (!isUUID(blobId)) {
    badRequest(response, "Invalid blob ID");
    return;
  }

  await serveBlob(config.storageBucket!, blobId, request, response);
}

export async function create(
  config: ServerConfig,
  request: Request,
  response: Response
) {
  const authenticating = await authenticate(request, response);
  if (!ok(authenticating)) {
    return;
  }
  if (!corsAll(request, response)) {
    return;
  }

  await createBlob(config, request, response);
}

export async function update(
  config: ServerConfig,
  request: Request,
  response: Response
) {
  const blobId = request.params["blobId"] ?? "";
  if (!isUUID(blobId)) {
    badRequest(response, "Invalid blob ID");
    return;
  }
  await updateFileApiInfo(config.storageBucket!, blobId, request, response);
}
