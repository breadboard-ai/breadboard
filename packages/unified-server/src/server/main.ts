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
import { makeCspHandler } from "./csp.js";
import { createUpdatesHandler } from "./upates.js";
import { CachingFeaturedGallery, makeGalleryMiddleware } from "./gallery.js";
import { GoogleAuth } from "google-auth-library";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { createMcpProxyHandler } from "./mcp-proxy.js";
import { SameSite } from "../../../connection-server/dist/config.js";

const FEATURED_GALLERY_CACHE_REFRESH_SECONDS = 10 * 60;

const server = express();

const { client: clientConfig, server: serverConfig } =
  await getConfigFromSecretManager();

server.use(makeCspHandler(serverConfig));

const boardServerConfig = boardServer.createServerConfig({
  storageProvider: "firestore",
  proxyServerAllowFilter,
});
const connectionServerConfig = {
  ...(await connectionServer.createServerConfig()),
  refreshTokenCookieSameSite: (serverConfig.REFRESH_TOKEN_COOKIE_SAME_SITE ||
    "Strict") as SameSite,
  validateResponse: allowListChecker(
    serverConfig.BACKEND_API_ENDPOINT &&
      new URL(serverConfig.BACKEND_API_ENDPOINT)
  ),
};

if (
  !["Lax", "Strict", "None"].includes(
    connectionServerConfig.refreshTokenCookieSameSite
  )
) {
  throw Error(
    `Invalid REFRESH_TOKEN_COOKIE_SAME_SITE value: ${connectionServerConfig.refreshTokenCookieSameSite}`
  );
}


boardServer.addMiddleware(server, boardServerConfig);
server.use("/board", boardServer.createRouter(boardServerConfig));

server.use(
  "/connection",
  connectionServer.createServer(connectionServerConfig)
);

server.use("/app/@:user/:name", boardServer.middlewares.loadBoard());

server.use("/updates", createUpdatesHandler());

server.use("/app", (req, res) => {
  // Redirect the old standalone app view to the new unified view with the app
  // tab opened.
  const graphId = req.path.replace(/^\//, "");
  res.redirect(301, `/?flow=${encodeURIComponent(graphId)}&mode=app`);
});

const googleAuth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});
const authClient = await googleAuth.getClient();
const driveClient = new GoogleDriveClient({
  getUserAccessToken: async () =>
    (await authClient.getAccessToken()).token ?? "",
});

const cachingGallery = await CachingFeaturedGallery.makeReady({
  folderId: serverConfig.GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID ?? "",
  driveClient,
  cacheRefreshSeconds: FEATURED_GALLERY_CACHE_REFRESH_SECONDS,
});

server.use(
  "/api/gallery",
  await makeGalleryMiddleware({ gallery: cachingGallery })
);

server.use(
  "/api/drive-proxy",
  makeDriveProxyMiddleware({
    shouldCacheMedia: (fileId) =>
      cachingGallery.isFeaturedGalleryGraph(fileId) ||
      cachingGallery.isFeaturedGalleryAsset(fileId),
    mediaCacheMaxAgeSeconds: FEATURED_GALLERY_CACHE_REFRESH_SECONDS,
  })
);

server.use(
  "/api/mcp-proxy",
  createMcpProxyHandler(serverConfig.MCP_SERVER_ALLOW_LIST)
);

ViteExpress.config({
  transformer: (html: string, req: Request) => {
    const board = req.res?.locals.loadedBoard;
    const displayName = board?.displayName || "Loading ...";
    const serverUrl = new URL(
      serverConfig.SERVER_URL ?? `http://localhost:${boardServerConfig.port}`
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
  } catch {
    return;
  }
}
