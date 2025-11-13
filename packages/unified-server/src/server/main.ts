/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as boardServer from "@breadboard-ai/board-server";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { createFetchWithCreds, err } from "@breadboard-ai/utils";
import express, { type Request } from "express";
import { GoogleAuth } from "google-auth-library";
import ViteExpress from "vite-express";
import { createClientConfig } from "./config.js";
import * as connectionServer from "./connection/server.js";
import { MAIN_APP_CSP, makeCspHandler } from "./csp.js";
import { createDataTransformHandler } from "./data-transform.js";
import { makeDriveProxyMiddleware } from "./drive-proxy.js";
import * as flags from "./flags.js";
import { CachingFeaturedGallery, makeGalleryMiddleware } from "./gallery.js";
import { createUpdatesHandler } from "./updates.js";

const FEATURED_GALLERY_CACHE_REFRESH_SECONDS = 10 * 60;

console.log("[unified-server startup] Starting unified server");

const server = express();

server.use(makeCspHandler(MAIN_APP_CSP));

const boardServerConfig = boardServer.createServerConfig({
  storageProvider: "firestore",
});
const connectionServerConfig = await connectionServer.createServerConfig();

console.log("[unified-server startup] Mounting board server");
boardServer.addMiddleware(server, boardServerConfig);
server.use("/board", boardServer.createRouter(boardServerConfig));

console.log("[unified-server startup] Mounting connection server");
server.use(
  "/connection",
  connectionServer.createServer(connectionServerConfig)
);

console.log("[unified-server startup] Mounting app view");
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
  fetchWithCreds: createFetchWithCreds(async () => {
    const { token } = await authClient.getAccessToken();
    if (!token) {
      return err(`Unable to obtain auth token`);
    }
    return token;
  }),
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

console.log("[unified-server startup] Mounting Data Tranform API");
server.use(
  "/api/data/transform",
  createDataTransformHandler(
    boardServerConfig.storageBucket,
    boardServerConfig.serverUrl
  )
);

console.log("[unified-server startup] Mounting static content");

const clientConfig = await createClientConfig({
  OAUTH_CLIENT: connectionServerConfig.connection.oauth.client_id,
});

if (flags.SHELL_ENABLED) {
  // TODO(aomarks) After we are fully in the iframe arrangement, move assets
  // around so that this entire re-pathing middleware is not necessary.
  console.log("[unified-server startup] Serving in shell configuration");
  server.use("/", (request, _response, next) => {
    if (
      // Files with extensions are always static and should be served normally.
      !request.path.includes(".") &&
      // Files in the @vite folder are dev-mode npm dependencies and should be
      // served normally.
      !request.path.startsWith("/@vite/")
    ) {
      if (request.path === "/oauth" || request.path.startsWith("/oauth/")) {
        request.url = "/oauth/index.html";
      } else if (
        request.path === "/_app/landing" ||
        request.path.startsWith("/_app/landing/")
      ) {
        request.url = "/landing/index.html";
      } else if (
        request.path === "/_app" ||
        request.path.startsWith("/_app/")
      ) {
        request.url = "/index.html";
      } else {
        request.url = "/shell/index.html";
      }
    }
    next();
  });
}

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
