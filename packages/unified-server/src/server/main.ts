/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type Request } from "express";
import ViteExpress from "vite-express";
import { config as loadEnv } from "dotenv";

import * as boardServer from "@breadboard-ai/board-server";
import * as connectionServer from "@breadboard-ai/connection-server";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { InputValues, NodeDescriptor } from "@breadboard-ai/types";

import { makeDriveProxyMiddleware } from "./drive-proxy.js";
import { allowListChecker } from "./allow-list-checker.js";
import { makeCspHandler } from "./csp.js";
import * as flags from "./flags.js";
import { CachingFeaturedGallery, makeGalleryMiddleware } from "./gallery.js";
import { createUpdatesHandler } from "./upates.js";

import { GoogleAuth } from "google-auth-library";
import { createMcpProxyHandler } from "./mcp-proxy.js";

const FEATURED_GALLERY_CACHE_REFRESH_SECONDS = 10 * 60;

console.log("[unified-server startup] Starting unified server");

console.log("[unified-server startup] Loading env file");
loadEnv();

const server = express();

const clientConfig = await flags.getConfig();

server.use(makeCspHandler());

const boardServerConfig = boardServer.createServerConfig({
  storageProvider: "firestore",
  proxyServerAllowFilter,
});
const connectionServerConfig = {
  ...(await connectionServer.createServerConfig()),
  validateResponse: allowListChecker(),
};

console.log("[unified-server startup] Mounting board server");
boardServer.addMiddleware(server, boardServerConfig);
server.use("/board", boardServer.createRouter(boardServerConfig));

console.log("[unified-server startup] Mounting connection server");
server.use(
  "/connection",
  connectionServer.createServer(connectionServerConfig)
);

console.log("[unified-server startup] Mounting app view");
server.use("/app/@:user/:name", boardServer.middlewares.loadBoard());
server.use("/app", (req, res) => {
  // Redirect the old standalone app view to the new unified view with the app
  // tab opened.
  const graphId = req.path.replace(/^\//, "");
  res.redirect(301, `/?flow=${encodeURIComponent(graphId)}&mode=app`);
});

console.log("[unified-server startup] Mounting updates handler");
server.use("/updates", createUpdatesHandler());

console.log("[unified-server startup] Creating Google Drive client");
const googleAuth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});
const authClient = await googleAuth.getClient();
const driveClient = new GoogleDriveClient({
  getUserAccessToken: async () =>
    (await authClient.getAccessToken()).token ?? "",
});

console.log("[unified-server startup] Mounting gallery");
const cachingGallery = await CachingFeaturedGallery.makeReady({
  driveClient,
  cacheRefreshSeconds: FEATURED_GALLERY_CACHE_REFRESH_SECONDS,
});

server.use(
  "/api/gallery",
  await makeGalleryMiddleware({ gallery: cachingGallery })
);

console.log("[unified-server startup] Mounting Drive proxy");
server.use(
  "/api/drive-proxy",
  makeDriveProxyMiddleware({
    shouldCacheMedia: (fileId) =>
      cachingGallery.isFeaturedGalleryGraph(fileId) ||
      cachingGallery.isFeaturedGalleryAsset(fileId),
    mediaCacheMaxAgeSeconds: FEATURED_GALLERY_CACHE_REFRESH_SECONDS,
  })
);

console.log("[unified-server startup] Mounting MCP proxy");
server.use("/api/mcp-proxy", createMcpProxyHandler());

console.log("[unified-server startup] Mounting static content");
ViteExpress.config({
  transformer: (html: string, req: Request) => {
    const board = req.res?.locals.loadedBoard;
    const displayName = board?.displayName || "Loading ...";
    const serverUrl = new URL(
      flags.SERVER_URL || `http://localhost:${boardServerConfig.port}`
    );
    const clientConfigStr = JSON.stringify(clientConfig).replaceAll(
      "</script>",
      "\x3C/script>"
    );
    const bucket =
      clientConfig.GOOGLE_FEEDBACK_BUCKET === "prod" ? "prod" : "dev";

    return html
      .replace("{{displayName}}", escape(displayName))
      .replace("{{config}}", clientConfigStr)
      .replace(/{{origin}}/gim, serverUrl.origin)
      .replace(/{{bucket}}/gim, bucket);
  },
});

ViteExpress.static({
  enableBrotli: true,
});

ViteExpress.listen(server, boardServerConfig.port, () => {
  console.log(
    `[unified-server startup] Listening for requests on port ${boardServerConfig.port}`
  );
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
  } catch {
    return;
  }
}
