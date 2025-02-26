/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type Express } from "express";
import type { ViteDevServer } from "vite";

import { makeRouter } from "./router.js";
import type { ServerConfig } from "./server/config.js";

export type { ServerConfig };

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "localhost";

export function createServer(config: ServerConfig): Express {
  const server = express();
  server.use(makeRouter(config));
  return server;
}

export function createServerConfig(
  rootPath: string,
  viteDevServer?: ViteDevServer
): ServerConfig {
  const {
    PORT = DEFAULT_PORT,
    HOST = DEFAULT_HOST,
    ALLOWED_ORIGINS = "",
    STORAGE_BUCKET,
    SERVER_URL,
  } = process.env;

  return {
    allowedOrigins: new Set(
      ALLOWED_ORIGINS.split(/\s+/).filter((origin) => origin !== "")
    ),
    hostname: `http://${HOST}:${PORT}`,
    port: +PORT || DEFAULT_PORT,
    rootPath,
    serverUrl: SERVER_URL,
    storageBucket: STORAGE_BUCKET,
    viteDevServer: viteDevServer ?? null,
  };
}
