/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import { serveBoardsAPI } from "./server/boards/index.js";
import { serveContent } from "./server/common.js";
import type { ServerConfig } from "./server/config.js";
import { serveHome } from "./server/home/index.js";
import { serveInfoAPI } from "./server/info/index.js";
import { serveProxyAPI } from "./server/proxy/index.js";
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
      if (await serveHome(serverConfig, req, res)) {
        return;
      }

      if (await serveProxyAPI(serverConfig, req, res)) {
        return;
      }

      if (await serveInfoAPI(req, res)) {
        return;
      }

      if (await serveBoardsAPI(serverConfig, req, res)) {
        return;
      }

      serveContent(serverConfig, req, res);
    } catch (err) {
      handleError(err as Error, res);
    }
  };
}
