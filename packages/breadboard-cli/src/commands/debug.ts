/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import http from "http";
import { dirname, extname, join, relative } from "path";
import handler from "serve-handler";
import { fileURLToPath, pathToFileURL } from "url";
import { BoardMetaData, loadBoards, watch } from "./lib/utils.js";
import { stat } from "fs/promises";
import { createReadStream } from "fs";
import { DebugOptions } from "./commandTypes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const clients: Record<string, http.ServerResponse> = {};

export const debug = async (file: string, options: DebugOptions) => {
  const distDir = join(__dirname, "..", "..", "debugger");
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
        boards = await loadBoards(file, options);

        // Notify all the clients that the board has changed.
        Object.values(clients).forEach((clientResponse) => {
          clientResponse.write(`event: update\ndata:na\nid:${Date.now()}\n\n`);
        });
      },
      onRename: async () => {
        // Refresh the list of boards that are passed in at the start of the server.
        console.log(`Refreshing boards...`);
        boards = await loadBoards(file, options);
      },
    });
  }

  const server = http.createServer(async (request, response) => {
    const requestURL = new URL(request.url ?? "", "http://localhost:3000");

    // We should think about a simple router here.. Right now we share a lot of state.
    if (requestURL.pathname === "/boards.js") {
      // Generate a list of boards that are valid at runtime.
      // Cache until things change.
      boards = await loadBoards(file, options);

      const boardsData = JSON.stringify(
        boards.map((board) => ({
          url: board.url,
          version: board.version,
          title: board.title,
        }))
      );

      const responseText = `const r = ${boardsData}; export default { Boards: r };`;

      response.writeHead(200, {
        "Content-Type": "application/javascript",
        "Content-Length": responseText.length,
      });

      return response.end(responseText);
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

    let board = boards.find((board) => board.url == requestURL.pathname);
    if (!board && extname(requestURL.pathname) === ".json") {
      // Attempt to load the board and append it to the list of boards.
      const possibleBoardPath = join(process.cwd(), requestURL.pathname);
      try {
        const newBoards = await loadBoards(possibleBoardPath, options);
        const [newBoard] = newBoards;
        boards.push(newBoard);
        board = newBoard;
      } catch (err) {
        // This board was not found.
      }
    }

    // We only want to serve the file that is being debugged... nothing else.
    if (board) {
      const boardData = JSON.stringify(board);
      response.writeHead(200, {
        "Content-Type": "application/json",
      });

      return response.end(boardData);
    }

    return handler(request, response, {
      public: distDir,
      //cleanUrls: ["/"],
    });
  });

  server.listen(3000, () => {
    const urlPath = isDirectory
      ? ""
      : `?board=/${relative(process.cwd(), fileUrl.pathname)}`;
    console.log(`Running at http://localhost:3000/${urlPath}`);
  });
};
