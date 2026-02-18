/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createFetchWithCreds, err } from "@breadboard-ai/utils";
import express, { type Request } from "express";
import { GoogleAuth } from "google-auth-library";
import ViteExpress from "vite-express";
import { createClientConfig, createServerConfig } from "./config.js";
import * as connectionServer from "./connection/server.js";
import {
  FALLBACK_CSP,
  GENERATED_APP_CSP,
  MAIN_APP_CSP,
  makeCspHandler,
  OAUTH_REDIRECT_CSP,
  SHELL_CSP,
} from "./csp.js";
import { makeDriveProxyMiddleware } from "./drive-proxy.js";
import * as flags from "./flags.js";
import { CachingFeaturedGallery, makeGalleryMiddleware } from "./gallery.js";
import { createUpdatesHandler } from "./updates.js";
import { makeBlobsHandler } from "./blobs/index.js";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";

const FEATURED_GALLERY_CACHE_REFRESH_SECONDS = 10 * 60;

console.log("[unified-server startup] Starting unified server");

const server = express();

server.use(makeCspHandler(FALLBACK_CSP));

console.log("[unified-server startup] Creating server config");
const serverConfig = createServerConfig();
server.use(express.json({ limit: "2GB", type: "*/*" }));

let oauthClientId;

if (flags.FAKE_MODE) {
  console.log("[unified-server startup] FAKE_MODE enabled");
  oauthClientId = "fake-oauth-client";
  const { FakeGoogleDriveApi } =
    await import("@breadboard-ai/utils/google-drive/fake-google-drive-api.js");
  const fakeDrive = await FakeGoogleDriveApi.start(flags.FAKE_DRIVE_PORT);
  fakeDrive.latencyMs = 100;
  console.log(
    `[unified-server startup] Fake Drive API running at: ${fakeDrive.apiBaseUrl}`
  );
} else {
  const connectionServerConfig = await connectionServer.createServerConfig();
  oauthClientId = connectionServerConfig.connection.oauth.client_id;

  console.log("[unified-server startup] Mounting blobs handler");
  server.use("/board/blobs", makeBlobsHandler(serverConfig));

  console.log("[unified-server startup] Mounting connection server");
  server.use(
    "/connection",
    connectionServer.createServer(connectionServerConfig)
  );

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
}

console.log("[unified-server startup] Mounting static content");

const clientConfig = await createClientConfig({
  OAUTH_CLIENT: oauthClientId,
});

server.get(
  ["/", "/landing/", "/open/:fileId", "/app/:fileId", "/edit/:fileId"].map(
    (path) => `${flags.SHELL_PREFIX || ""}${path}`
  ),
  makeCspHandler(SHELL_CSP),
  (req, _res, next) => {
    req.url = "/shell/index.html";
    next();
  }
);
server.get(
  ["/_app/", "/_app/open/:fileId", "/_app/app/:fileId", "/_app/edit/:fileId"],
  makeCspHandler(MAIN_APP_CSP),
  (req, _res, next) => {
    req.url = "/index.html";
    next();
  }
);
server.get(
  "/_app/landing/",
  makeCspHandler(MAIN_APP_CSP),
  (req, _res, next) => {
    req.url = "/landing/index.html";
    next();
  }
);
server.get(
  "/_app/_app-sandbox/",
  makeCspHandler(GENERATED_APP_CSP),
  (req, _res, next) => {
    req.url = "/app-sandbox.html";
    next();
  }
);

server.get("/oauth/", makeCspHandler(OAUTH_REDIRECT_CSP));

ViteExpress.config({
  transformer: (html: string, req: Request) => {
    const board = req.res?.locals.loadedBoard;
    const displayName = board?.displayName || "Loading ...";
    const serverUrl = new URL(
      flags.SERVER_URL || `http://localhost:${serverConfig.port}`
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

ViteExpress.listen(server, serverConfig.port, () => {
  const url = `http://localhost:${serverConfig.port}`;
  const label = flags.FAKE_MODE ? "Fake Opal" : "Real Opal";
  const subtitle = flags.FAKE_MODE ? "(For agents)" : "(For humans)";
  const yellow = "\x1b[33m";
  const blue = "\x1b[34m";
  const bold = "\x1b[1m";
  const inverse = "\x1b[7m";
  const reset = "\x1b[0m";
  const color = flags.FAKE_MODE ? yellow : blue;
  console.log("");
  console.log(`  ${color}${inverse}${bold} ${label} ${reset}  ${color}${bold}${url}${reset}  ${subtitle}`);
  console.log("");
});

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
