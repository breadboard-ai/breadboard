/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cors from "cors";
import express, { type Express } from "express";

import { getUserCredentials } from "./server/auth.js";
import type { ServerConfig } from "./server/config.js";
import { serveBlobsAPI } from "./server/blobs/index.js";
import { serveBoardsAPI } from "./server/boards/index.js";
import { serveHome } from "./server/home/index.js";
import { serveInfoAPI } from "./server/info/index.js";
import { serveMeAPI } from "./server/info/me.js";
import { serveProxyAPI } from "./server/proxy/index.js";
import { getStore } from "./server/store.js";

export type { ServerConfig };

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "localhost";

export function createServer(config: ServerConfig): Express {
  const server = express();

  server.use(
    cors({
      origin: true,
      credentials: true,
      // Different browsers allow different max values for max age. The highest
      // seems to be 24 hours.
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
      maxAge: 24 * 60 * 60,
    })
  );

  server.locals.store = getStore();

  server.use(getUserCredentials());

  server.get("/", serveHome);

  server.use("/blobs", serveBlobsAPI(config));
  server.use("/boards", serveBoardsAPI(config));
  server.use("/info", serveInfoAPI());
  server.use("/me", serveMeAPI());
  server.use("/proxy", serveProxyAPI(config));

  return server;
}

export function createServerConfig(): ServerConfig {
  const {
    PORT = DEFAULT_PORT,
    HOST = DEFAULT_HOST,
    STORAGE_BUCKET,
    SERVER_URL,
  } = process.env;

  return {
    hostname: `http://${HOST}:${PORT}`,
    port: +PORT || DEFAULT_PORT,
    serverUrl: SERVER_URL,
    storageBucket: STORAGE_BUCKET,
  };
}
