/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { badRequest, methodNotAllowed } from "../errors.js";
import { buildSecretsTunnel, secretsKit } from "./secrets.js";
import {
  ProxyServer,
  type ServerResponse as ProxyServerResponse,
  type AnyProxyRequestMessage,
  HTTPServerTransport,
  type ProxyServerConfig,
} from "@google-labs/breadboard/remote";
import { asRuntimeKit, ok, type DataStore } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import { getDataStore } from "@breadboard-ai/data-store";
import type { ServerConfig } from "../config.js";
import { cors } from "../cors.js";
import { timestamp } from "../boards/utils/run-board.js";
import { BlobDataStore, GoogleStorageBlobStore } from "../blob-store.js";
import { authenticate } from "../auth.js";

class ResponseAdapter implements ProxyServerResponse {
  #response: ServerResponse;

  constructor(response: ServerResponse) {
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

const extractRequestBody = async (request: IncomingMessage) => {
  return new Promise<AnyProxyRequestMessage>((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      resolve(JSON.parse(body) as AnyProxyRequestMessage);
    });
    request.on("error", reject);
  });
};

export const serveProxyAPI = async (
  serverConfig: ServerConfig,
  req: IncomingMessage,
  res: ServerResponse
) => {
  const url = new URL(req.url || "", serverConfig.hostname);
  const isProxy = url.pathname === "/proxy" || url.pathname === "/proxy/";
  if (!isProxy) {
    return false;
  }

  if (!cors(req, res, serverConfig.allowedOrigins)) {
    return true;
  }

  const authenticating = authenticate(req, null);
  if (!ok(authenticating)) {
    // Output the error in node proxy response format.
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 401;
    res.end(
      JSON.stringify([
        "error",
        {
          error: "Need a valid server key to access the node proxy.",
          timestamp: timestamp(),
        },
      ])
    );
    return true;
  }

  if (req.method !== "POST") {
    methodNotAllowed(res, "Use POST method");
    return true;
  }

  const body = await extractRequestBody(req);
  const server = new ProxyServer(
    new HTTPServerTransport({ body }, new ResponseAdapter(res))
  );
  const store = createDataStore(serverConfig);
  store.createGroup("run-board");

  const tunnel = await buildSecretsTunnel();
  const config: ProxyServerConfig = {
    kits: [secretsKit, asRuntimeKit(Core)],
    store,
    proxy: ["fetch", { node: "secrets", tunnel }],
  };

  try {
    await server.serve(config);
  } catch (e) {
    badRequest(res, (e as Error).message);
  }

  store.releaseAll();

  return true;
};

function createDataStore(config: ServerConfig): DataStore {
  const { storageBucket, serverUrl } = config;
  if (!storageBucket || !serverUrl) {
    return getDataStore();
  }
  return new BlobDataStore(
    new GoogleStorageBlobStore(storageBucket, serverUrl),
    serverUrl
  );
}
