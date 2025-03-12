/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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

  server.locals.store = getStore();

  server.use(getUserCredentials());

  server.get("/", async (req, res) => serveHome(config, req, res));

  server.use("/blobs", serveBlobsAPI(config));
  server.use("/boards", serveBoardsAPI(config));
  server.use("/info", serveInfoAPI());
  server.use("/me", serveMeAPI(config));
  server.use("/proxy", serveProxyAPI(config));

  return server;
}

export function createServerConfig(rootPath: string): ServerConfig {
  const {
    PORT = DEFAULT_PORT,
    HOST = DEFAULT_HOST,
    ALLOWED_ORIGINS = "",
    STORAGE_BUCKET,
    SERVER_URL,
  } = process.env;

  return {
    allowedOrigins: ALLOWED_ORIGINS.split(/\s+/).filter(
      (origin) => origin !== ""
    ),
    hostname: `http://${HOST}:${PORT}`,
    port: +PORT || DEFAULT_PORT,
    rootPath,
    serverUrl: SERVER_URL,
    storageBucket: STORAGE_BUCKET,
  };
}
