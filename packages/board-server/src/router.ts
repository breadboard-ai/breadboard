/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import { serveContent } from "./server/common.js";
import type { ServerConfig } from "./server/config.js";
import { serverError } from "./server/errors.js";

const handleError = (err: Error, res: ServerResponse) => {
  console.error("Server Error:", err);
  if (!res.writableEnded) {
    serverError(res, "Internal server error");
  }
};

export function makeRouter(serverConfig: ServerConfig) {
  return async function router(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    try {
      serveContent(serverConfig, req, res);
    } catch (err) {
      handleError(err as Error, res);
    }
  };
}
