/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Request, type Response, Router } from "express";
import { URL } from "node:url";

import {
  ProxyServer,
  type ServerResponse as ProxyServerResponse,
  HTTPServerTransport,
  type ProxyServerConfig,
} from "@google-labs/breadboard/remote";
import { asRuntimeKit, type DataStore } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import { getDataStore } from "@breadboard-ai/data-store";

import { badRequest } from "../errors.js";
import { buildSecretsTunnel, secretsKit } from "./secrets.js";
import type { ServerConfig } from "../config.js";
import { BlobDataStore, GoogleStorageBlobStore } from "../blob-store.js";
import { GcsAwareFetch } from "./gcs-aware-fetch.js";

class ResponseAdapter implements ProxyServerResponse {
  #response: Response;

  constructor(response: Response) {
    this.#response = response;
  }

  header(field: string, value: string): unknown {
    this.#response.setHeader(field, value);
    return this;
  }

  write(chunk: unknown): boolean {
    return this.#response.write(chunk);
  }

  end(): unknown {
    this.#response.end();
    return this;
  }
}

export function serveProxyAPI(serverConfig: ServerConfig): Router {
  const router = Router();

  // TODO: Re-enable once we teach the client side to send auth requests
  // https://github.com/breadboard-ai/breadboard/issues/4721
  // router.use(requireAuth());

  router.post("/", (req, res) => post(serverConfig, req, res));

  return router;
}

async function post(
  serverConfig: ServerConfig,
  req: Request,
  res: Response
): Promise<void> {
  const gcsAwareFetchKit = GcsAwareFetch.instance(
    req.app.locals.store,
    serverConfig
  ).createKit(asRuntimeKit(Core));

  const server = new ProxyServer(
    new HTTPServerTransport({ body: req.body }, new ResponseAdapter(res))
  );
  const store = createDataStore(serverConfig);
  store.createGroup("run-board");

  const tunnel = await buildSecretsTunnel();
  const config: ProxyServerConfig = {
    kits: [secretsKit, gcsAwareFetchKit],
    store,
    proxy: ["fetch", { node: "secrets", tunnel }],
  };

  try {
    await server.serve(config);
  } catch (e) {
    badRequest(res, (e as Error).message);
  }

  store.releaseAll();
}

function createDataStore(config: ServerConfig): DataStore {
  const { storageBucket, serverUrl } = config;
  if (!storageBucket || !serverUrl) {
    return getDataStore();
  }
  return new BlobDataStore(
    new GoogleStorageBlobStore(storageBucket, serverUrl),
    new URL(serverUrl).origin
  );
}
