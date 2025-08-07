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

// import { makeDriveProxyMiddleware } from "./drive-proxy.js";
import { allowListChecker } from "./allow-list-checker.js";
import { getConfigFromSecretManager } from "./provide-config.js";
import { makeCspHandler } from "./csp.js";
import { createUpdatesHandler } from "./upates.js";
import { createMountedFileSystemHandler } from "./mounted-file-system.js";
import { GoogleAuth } from "google-auth-library";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";

const server = express();

const { client: clientConfig, server: serverConfig } =
  await getConfigFromSecretManager();

server.use(makeCspHandler(serverConfig));

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

// server.use(
//   "/files",
//   makeDriveProxyMiddleware({
//     publicApiKey: serverConfig.GOOGLE_DRIVE_PUBLIC_API_KEY,
//     serverUrl: serverConfig.SERVER_URL,
//     featuredGalleryFolderId:
//       serverConfig.GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID,
//   })
// );

server.use("/updates", createUpdatesHandler());

server.use("/app", (req, res) => {
  // Redirect the old standalone app view to the new unified view with the app
  // tab opened.
  const graphId = req.path.replace(/^\//, "");
  res.redirect(301, `/?flow=${encodeURIComponent(graphId)}&mode=app`);
});

server.use("/mnt", createMountedFileSystemHandler());

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
  void testDriveAccess();
});

/**
 * This is a temporary function that runs asyncronously when unified server
 * starts up to test Google Drive access with service account credentials.
 */
async function testDriveAccess() {
  try {
    console.log(`[testDriveAccess] Starting test`);
    const googleAuth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    const authClient = await googleAuth.getClient();
    const driveClient = new GoogleDriveClient({
      getUserAccessToken: async () =>
        (await authClient.getAccessToken()).token ?? "",
      // No public or domain fallback.
      publicReadStrategy: { kind: "none" },
      domainProxyUrl: undefined,
      extraHeaders: {
        // During local development we are using user credentials, which means
        // we must explicitly set the billing GCP project. Not required in
        // production, but doesn't hurt. See
        // https://cloud.google.com/docs/authentication/rest#set-billing-project
        ["x-goog-user-project"]: await googleAuth.getProjectId(),
      },
    });
    const galleryFiles = (
      await driveClient.listFiles(`
        mimeType="application/vnd.breadboard.graph+json"
        and "${serverConfig.GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID ?? ""}" in parents
        and trashed=false
      `)
    ).files;
    console.log(
      `[testDriveAccess] Listed ${galleryFiles.length} gallery files.`
    );
    const first = galleryFiles[0];
    if (first) {
      const metadata = await driveClient.getFileMetadata(first.id);
      console.log(`[testDriveAccess] Got metadata for ${first.id}`, metadata);
      const media = await driveClient.getFileMedia(first.id);
      console.log(`[testDriveAccess] Got media for ${first.id}`, media);
    }
    console.log(`[testDriveAccess] Done`);
  } catch (e) {
    console.log(`[testDriveAccess] Exception`, e);
  }
}

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
