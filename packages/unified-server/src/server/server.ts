/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cors from "cors";
import express, { type Express, Router } from "express";

import type { ServerConfig } from "../types.js";
import { serveBlobsAPI } from "./blobs/index.js";

export type { ServerConfig };

export { GoogleStorageBlobStore } from "./blobs/blob-store.js";

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "localhost";

export function addMiddleware(server: Express) {
  server.use(express.json({ limit: "2GB", type: "*/*" }));
}

export function createRouter(config: ServerConfig): Router {
  const router = Router();

  router.use(
    cors({
      origin: true,
      credentials: true,
      // Different browsers allow different max values for max age. The highest
      // seems to be 24 hours.
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
      maxAge: 24 * 60 * 60,
    })
  );

  router.use("/blobs", serveBlobsAPI(config));
  return router;
}

export function createServerConfig(): ServerConfig {
  console.log("[board-server startup] Creating board server config");
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
