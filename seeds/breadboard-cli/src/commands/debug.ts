/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import http from "http";
import { dirname, join, relative } from "path";
import handler from "serve-handler";
import { fileURLToPath, pathToFileURL } from "url";
import { BoardMetaData, loadBoards, watch } from "./lib/utils.js";
import { stat } from "fs/promises";
import { createReadStream } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const clients: Record<string, http.ServerResponse> = {};

export const debug = async (file: string, options: Record<string, any>) => {
  const distDir = join(__dirname, "..", "..", "ui");
  let boards: Array<BoardMetaData> = [];

  if (file == undefined) {
    file = process.cwd();
  }

  const isDirectory = (await stat(file)).isDirectory();

  const fileUrl = pathToFileURL(file);

  if ("watch" in options) {
    watch(file, {
      onChange: async (filename: string) => {
        // Refresh the list of boards that are passed in at the start of the server.
        console.log(`${filename} changed. Refreshing boards...`);
        boards = await loadBoards(file);

        // Notify all the clients that the board has changed.
        Object.values(clients).forEach((clientResponse) => {
          clientResponse.write(`event: update\ndata:na\nid:${Date.now()}\n\n`);
        });
      },
      onRename: async () => {
        // Refresh the list of boards that are passed in at the start of the server.
        console.log(`Refreshing boards...`);
        boards = await loadBoards(file);
      },
    });
  }

  const server = http.createServer(async (request, response) => {
    const requestURL = new URL(request.url ?? "", "http://localhost:3000");

    // We should think about a simple router here.. Right now we share a lot of state.
    if (requestURL.pathname === "/local-boards.json") {
      // Generate a list of boards that are valid at runtime.
      // Cache until things change.
      boards = await loadBoards(file);

      const boardsData = JSON.stringify(
        boards.map((board) => ({
          url: board.url,
          version: board.version,
          title: board.title,
        }))
      );

      response.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": boardsData.length,
      });

      return response.end(boardsData);
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

      if (requestURL.pathname === "/~~debug") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        const clientId =
          Date.now() +
          Buffer.from(crypto.getRandomValues(new Uint32Array(10))).toString(
            "hex"
          );
        response.on("close", () => {
          delete clients[clientId];
        });
        clients[clientId] = response;
        return;
      }
    }

    const board = boards.find((board) => board.url == requestURL.pathname);

    // We only want to serve the file that is being debugged... nothing else.
    if (board) {
      const boardData = JSON.stringify(board);
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": boardData.length,
      });

      return response.end(boardData);
    }

    return handler(request, response, { public: distDir });
  });

  server.listen(3000, () => {
    const urlPath = isDirectory
      ? ""
      : `?board=/${relative(process.cwd(), fileUrl.pathname)}`;
    console.log(`Running at http://localhost:3000/${urlPath}`);
  });
};
