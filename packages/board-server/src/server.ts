/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type Express } from "express";
import type { ViteDevServer } from "vite";

import { makeRouter } from "./router.js";

import type { ServerConfig } from "./server/config.js";
import * as blobs from "./server/blobs/index.js";
import { serveHome } from "./server/home/index.js";
import { serveInfoAPI } from "./server/info/index.js";
import { serveMeAPI } from "./server/info/me.js";
import { serveProxyAPI } from "./server/proxy/index.js";

export type { ServerConfig };

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "localhost";

export function createServer(config: ServerConfig): Express {
  const server = express();

  server.get("/", async (req, res) => serveHome(config, req, res));

  server.post("/proxy", async (req, res) => serveProxyAPI(config, req, res));

  server.get("/info", serveInfoAPI);

  server.get("/me", async (req, res) => serveMeAPI(config, req, res));

  // The old router for blobs skipped handling if storage bucket was undefined.
  // Not sure if that was intentional, but this preserves the behavior until we
  // can figure that out.
  if (config.storageBucket) {
    server.get("/blobs/:blobId", (req, res) => blobs.get(config, req, res));
    server.post("/blobs", (req, res) => blobs.create(config, req, res));
    server.post("/blobs/:blobId/file", (req, res) =>
      blobs.update(config, req, res)
    );
  }

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
