/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cors from "cors";
import express, { type Express, Router } from "express";

import { getUserCredentials } from "./server/auth.js";
import type { ServerConfig, StorageProvider } from "./server/config.js";
import { serveBlobsAPI } from "./server/blobs/index.js";
import { serveBoardsAPI } from "./server/boards/index.js";
import { serveHome } from "./server/home/index.js";
import { type BoardServerStore } from "./server/store.js";
import { InMemoryStorageProvider } from "./server/storage-providers/inmemory.js";
import { FirestoreStorageProvider } from "./server/storage-providers/firestore.js";

export type { ServerConfig, StorageProvider };
export {
  getUserCredentials,
  requireAuth,
  requireAccessToken,
} from "./server/auth.js";

export { GoogleStorageBlobStore } from "./server/blob-store.js";
export { GeminiFileApi } from "./server/blobs/utils/gemini-file-api.js";

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "localhost";

export function createServer(config: ServerConfig): Express {
  const server = express();
  addMiddleware(server, config);
  server.use(createRouter(config));

  return server;
}

export function addMiddleware(server: Express, config: ServerConfig) {
  server.locals.store = createStore(config.storageProvider);
  server.use(express.json({ limit: "2GB", type: "*/*" }));
  server.use(getUserCredentials());
}

function createStore(storageProvider: StorageProvider): BoardServerStore {
  switch (storageProvider) {
    case "in-memory":
      console.log(
        "[board-server startup] Initializing in-memory storage provider"
      );
      return new InMemoryStorageProvider();
    case "firestore":
      console.log(
        "[board-server startup] Initializing Firestore storage provider"
      );
      return new FirestoreStorageProvider();
  }
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

  router.get("/", serveHome);

  router.use("/blobs", serveBlobsAPI(config));
  router.use("/boards", serveBoardsAPI(config));

  return router;
}

export function createServerConfig(opts: {
  storageProvider: StorageProvider;
}): ServerConfig {
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
    storageProvider: opts?.storageProvider ?? "firestore",
    serverUrl: SERVER_URL,
    storageBucket: STORAGE_BUCKET,
  };
}
