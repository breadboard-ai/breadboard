/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import http, { IncomingMessage, ServerResponse } from "http";
import { join, relative } from "path";
import handler from "serve-handler";
import { pathToFileURL, URL } from "url";
import { BoardMetaData, defaultKits } from "./utils.js";
import { stat } from "fs/promises";
import { createReadStream } from "fs";
import { DebugOptions } from "../commandTypes.js";
import { __dirname } from "../debug.js";
import { KitData, getKits } from "./kits.js";

import { URLPattern } from "urlpattern-polyfill";
import { routes } from "./routes.js";

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

export const startServer = async (file: string, options: DebugOptions) => {
  const distDir = join(__dirname, "..", "..", "debugger");
  const fileStat = await stat(file);
  const fileUrl = pathToFileURL(file);
  const isDirectory = fileStat.isDirectory();
  const boards: Array<BoardMetaData> = []; // Boards are dynamically loaded based on the "/boards.js" request.
  const kits = await getKits(defaultKits, options.kit);
  const clients: Record<string, http.ServerResponse> = {};
  const base = new URL("http://localhost:3000");

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
        const routeResponse = routes[route](request, response, match, globals);
        if (routeResponse == undefined) {
          continue;
        } else {
          return routeResponse;
        }
      }
    }

    if ("watch" in options) {
      if (
        requestURL.pathname === "/" ||
        requestURL.pathname === "/index.html"
      ) {
        response.writeHead(200, {
          "Content-Type": "text/html",
        });

        // Need to check this doesn't include "../" and other escape characters.
        const fileStream = createReadStream(`${distDir}/index.html`);
        fileStream.pipe(response, { end: false });
        fileStream.on("end", () => {
          response.write(`<!-- Added by Debug command --><script>
const evtSource = new EventSource("/~~debug");
evtSource.addEventListener("update", () => { window.location.reload(); });</script>`);
          response.end();
        });
        return;
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
    console.log(`Running at http://localhost:3000/${urlPath}`);
  });

  return { notifyClients };
};
