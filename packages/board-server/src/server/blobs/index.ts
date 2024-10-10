/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { authenticate } from "../auth.js";
import type { ServerConfig } from "../config.js";
import { badRequest, unauthorized } from "../errors.js";
import { createBlob } from "./create.js";
import { serveBlob } from "./serve.js";
import { corsAll } from "../cors.js";

export { serveBlobsAPI };

async function serveBlobsAPI(
  config: ServerConfig,
  req: IncomingMessage,
  res: ServerResponse
) {
  console.log("🌻 serveBlobsAPI", config.storageBucket);
  if (!config.storageBucket) {
    return false;
  }
  const url = new URL(req.url!, `http://localhost/`);
  const [api, blob] = url.pathname.split("/").slice(1);
  if (api !== "blobs") {
    return false;
  }

  if (!authenticate(req, res)) {
    return true;
  }

  if (!blob) {
    if (req.method === "POST") {
      if (!corsAll(req, res)) {
        return true;
      }

      await createBlob(req, res);
      return true;
    }
    badRequest(res, "Invalid blob request");
    return true;
  }

  if (!isUUID(blob)) {
    badRequest(res, "Invalid blob ID");
  }

  if (req.method === "GET") {
    if (!corsAll(req, res)) {
      return true;
    }

    return serveBlob(blob, req, res);
  }
  return false;
}

function isUUID(blob: string) {
  return (
    blob &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(blob)
  );
}
