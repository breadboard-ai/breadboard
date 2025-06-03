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
import { serveInfoAPI } from "./server/info/index.js";
import { serveMeAPI } from "./server/info/me.js";
import { serveProxyAPI } from "./server/proxy/index.js";
import { type BoardServerStore } from "./server/store.js";
import { loadBoard } from "./server/boards/loader.js";
import { InMemoryStorageProvider } from "./server/storage-providers/inmemory.js";
import { FirestoreStorageProvider } from "./server/storage-providers/firestore.js";
import type { AllowFilterFunction } from "@google-labs/breadboard/remote";

export type { ServerConfig, StorageProvider };
export { SecretsProvider } from "./server/proxy/secrets.js";

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "localhost";

export const middlewares = {
  loadBoard,
};

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
      return new InMemoryStorageProvider();
    case "firestore":
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
  router.use("/info", serveInfoAPI());
  router.use("/me", serveMeAPI());
  router.use("/proxy", serveProxyAPI(config));

  return router;
}

export function createServerConfig(opts: {
  storageProvider: StorageProvider;
  proxyServerAllowFilter?: AllowFilterFunction;
}): ServerConfig {
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
    proxyServerAllowFilter: opts?.proxyServerAllowFilter,
  };
}
