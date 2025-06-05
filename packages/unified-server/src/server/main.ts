/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type Request } from "express";
import ViteExpress from "vite-express";

import * as connectionServer from "@breadboard-ai/connection-server";
import * as boardServer from "@breadboard-ai/board-server";
import { InputValues, NodeDescriptor } from "@breadboard-ai/types";

import { makeDriveProxyMiddleware } from "./drive-proxy.js";
import { allowListChecker } from "./allow-list-checker.js";
import { getConfigFromSecretManager } from "./provide-config.js";

const server = express();

const { client: clientConfig, server: serverConfig } =
  await getConfigFromSecretManager();

let googleDriveProxyUrl: string | undefined;
if (serverConfig.ENABLE_GOOGLE_DRIVE_PROXY) {
  if (serverConfig.BACKEND_API_ENDPOINT) {
    googleDriveProxyUrl = new URL(
      "v1beta1/getOpalFile",
      serverConfig.BACKEND_API_ENDPOINT
    ).href;
  } else {
    console.warn(
      `ENABLE_GOOGLE_DRIVE_PROXY was true but BACKEND_API_ENDPOINT was missing.` +
        ` Google Drive proxying will not be available.`
    );
  }
}

const boardServerConfig = boardServer.createServerConfig({
  storageProvider: "firestore",
  proxyServerAllowFilter,
  googleDriveProxyUrl,
});
const connectionServerConfig = {
  ...(await connectionServer.createServerConfig()),
  validateResponse: allowListChecker(
    serverConfig.BACKEND_API_ENDPOINT &&
      new URL(serverConfig.BACKEND_API_ENDPOINT)
  ),
};

boardServer.addMiddleware(server, boardServerConfig);
server.use("/board", boardServer.createRouter(boardServerConfig));

server.use(
  "/connection",
  connectionServer.createServer(connectionServerConfig)
);

server.use("/app/@:user/:name", boardServer.middlewares.loadBoard());

server.use("/drive-proxy", makeDriveProxyMiddleware());

ViteExpress.config({
  transformer: (html: string, req: Request) => {
    const board = req.res?.locals.loadedBoard;
    const displayName = board?.displayName || "Loading ...";
    return html
      .replace("{{displayName}}", escape(displayName))
      .replace("{{config}}", clientConfig);
  },
});

ViteExpress.static({
  enableBrotli: true,
});

ViteExpress.listen(server, boardServerConfig.port, () => {
  console.log(`Unified server at: http://localhost:${boardServerConfig.port}`);
});

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function proxyServerAllowFilter(
  node: NodeDescriptor,
  inputs: InputValues
): boolean {
  // Not a fetch node, so we'll allow it.
  if (node.type !== "fetch") return true;
  if (!("url" in inputs && inputs.url)) return false;
  if (typeof inputs.url !== "string") return false;

  const url = parseUrl(inputs.url);
  if (!url) return false;
  return url.origin.endsWith(".googleapis.com");
}

function parseUrl(s: string): URL | undefined {
  try {
    return new URL(s);
  } catch (e) {
    return;
  }
}
