/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import http, { IncomingMessage, ServerResponse } from "http";
import { join, relative } from "path";
import handler from "serve-handler";
import { pathToFileURL, URL } from "url";
import { BoardMetaData, SERVER_URL, defaultKits } from "./utils.js";
import { stat } from "fs/promises";
import { URLPattern } from "urlpattern-polyfill";

import { DebugOptions } from "../commandTypes.js";
import { __dirname } from "../debug.js";
import { KitData, getKits } from "./kits.js";

import { boards } from "./debug-routes/boards.js";
import { kits } from "./debug-routes/kits.js";
import { kit } from "./debug-routes/kit.js";
import { debug } from "./debug-routes/debug.js";
import { board } from "./debug-routes/board.js";
import { index } from "./debug-routes/index.js";

export type Routes = Record<
  string,
  (
    request: http.IncomingMessage,
    response: http.ServerResponse,
    match: URLPatternResult,
    globals: ServerGlobals
  ) => Promise<ServerResponse<IncomingMessage> | void>
>;

export type ServerGlobals = {
  distDir: string;
  fileUrl: URL;
  isDirectory: boolean;
  boards: Array<BoardMetaData>;
  file: string;
  options: DebugOptions;
  kits: Array<KitData>;
  base: URL;
  clients: Record<string, http.ServerResponse>;
};

// This is the main routing table for the debug server.
const routes: Routes = {
  "/": index,
  "/index.html": index,
  "/boards.js": boards,
  "/kits.json": kits,
  "/kits/:kitName(.*)": kit,
  "/~~debug": debug,
  "/*.(json|ts)": board, // after kits.json
};

export const startServer = async (file: string, options: DebugOptions) => {
  const distDir = join(__dirname, "..", "..", "debugger");
  const fileStat = await stat(file);
  const fileUrl = pathToFileURL(file);
  const isDirectory = fileStat.isDirectory();
  const boards: Array<BoardMetaData> = []; // Boards are dynamically loaded based on the "/boards.js" request.
  const kits = await getKits(defaultKits, options.kit);
  const clients: Record<string, http.ServerResponse> = {};
  const base = new URL(SERVER_URL);

  const globals: ServerGlobals = {
    distDir,
    fileUrl,
    isDirectory,
    boards,
    file,
    options,
    kits,
    clients,
    base,
  };

  const notifyClients = () => {
    Object.values(clients).forEach((clientResponse) => {
      clientResponse.write(`event: update\ndata:na\nid:${Date.now()}\n\n`);
    });
  };

  const server = http.createServer(async (request, response) => {
    const requestURL = new URL(request.url ?? "", base.origin);

    for (const route in routes) {
      const routePattern = new URLPattern(route, base.origin);
      const match = routePattern.exec(requestURL);
      if (match) {
        const routeResponse = await routes[route](
          request,
          response,
          match,
          globals
        );
        if (routeResponse == undefined) {
          continue;
        } else {
          return routeResponse;
        }
      }
    }

    return handler(request, response, {
      public: distDir,
      cleanUrls: ["/"],
    });
  });

  server.listen(3000, () => {
    const urlPath = isDirectory
      ? ""
      : `?board=/${relative(process.cwd(), fileUrl.pathname)}`;
    console.log(`Running at ${SERVER_URL}/${urlPath}`);
  });

  return { notifyClients };
};
