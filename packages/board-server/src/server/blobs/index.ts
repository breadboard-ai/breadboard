/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { authenticate } from "../auth.js";
import type { ServerConfig } from "../config.js";
import { badRequest } from "../errors.js";
import { createBlob } from "./create.js";
import { serveBlob } from "./serve.js";
import { corsAll } from "../cors.js";
import { isUUID } from "../blob-store.js";

export { serveBlobsAPI };

async function serveBlobsAPI(
  config: ServerConfig,
  req: IncomingMessage,
  res: ServerResponse
) {
  if (!config.storageBucket) {
    return false;
  }
  const url = new URL(req.url!, `http://localhost/`);
  const [api, blob] = url.pathname.split("/").slice(1);
  if (api !== "blobs") {
    return false;
  }

  if (!blob) {
    if (req.method === "POST") {
      if (!(await authenticate(req, res))) {
        return true;
      }
      if (!corsAll(req, res)) {
        return true;
      }

      await createBlob(config, req, res);
      return true;
    }
    badRequest(res, "Invalid blob request");
    return true;
  }

  if (!isUUID(blob)) {
    badRequest(res, "Invalid blob ID");
  }

  if (req.method === "GET") {
    return serveBlob(config.storageBucket, blob, req, res);
  }
  return false;
}
