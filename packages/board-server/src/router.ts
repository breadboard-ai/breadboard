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
import { serveMeAPI } from "./server/info/me.js";
import { serveBlobsAPI } from "./server/blobs/index.js";
import type { ViteDevServer } from "vite";

export { createServerConfig };

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "localhost";

function createServerConfig(
  rootPath: string,
  viteDevServer: ViteDevServer | null = null
): ServerConfig {
  const {
    PORT = DEFAULT_HOST,
    HOST = DEFAULT_HOST,
    ALLOWED_ORIGINS = "",
    STORAGE_BUCKET,
    SERVER_URL,
  } = process.env;

  const storageBucket = STORAGE_BUCKET;

  return {
    allowedOrigins: new Set(
      ALLOWED_ORIGINS.split(/\s+/).filter((origin) => origin !== "")
    ),
    hostname: `http://${HOST}:${PORT}`,
    serverUrl: SERVER_URL,
    port: toNumericPort(PORT),
    viteDevServer,
    rootPath,
    storageBucket,
  };
}

function toNumericPort(port: string | number): number {
  if (typeof port === "number") return port;

  const numericPort = parseInt(port);
  return isNaN(numericPort) ? DEFAULT_PORT : numericPort;
}

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

      if (await serveMeAPI(serverConfig, req, res)) {
        return;
      }

      if (await serveBoardsAPI(serverConfig, req, res)) {
        return;
      }

      if (await serveBlobsAPI(serverConfig, req, res)) {
        return;
      }

      serveContent(serverConfig, req, res);
    } catch (err) {
      handleError(err as Error, res);
    }
  };
}
