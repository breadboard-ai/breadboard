/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createReadStream } from "fs";
import http from "http";
import { dirname, join, relative } from "path";
import handler from "serve-handler";
import { fileURLToPath, pathToFileURL } from "url";
import { BoardMetaData, compileKits, loadBoards, watch } from "./lib/utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const debug = async (file: string, options: Record<string, any>) => {
  const distDir = join(__dirname, "..", "..", "ui");
  const kitDeclarations = options.kit as string[] | undefined;
  let boards: Array<BoardMetaData> = [];
  let kitOutput: Record<string, string>;

  if (kitDeclarations != undefined) {
    // We should warn if we are importing code and the associated risks
    kitOutput = await compileKits(kitDeclarations);
  }

  if (file == undefined) {
    file = process.cwd();
  }

  const fileUrl = pathToFileURL(file);

  if ("watch" in options) {
    watch(file, {
      onChange: async (filename: string) => {
        // Refresh the list of boards that are passed in at the start of the server.
        console.log(`${filename} changed. Refreshing boards...`);
        boards = await loadBoards(file);
      },
      onRename: async () => {
        // Refresh the list of boards that are passed in at the start of the server.
        console.log(`Refreshing boards...`);
        boards = await loadBoards(file);
      },
    });
  }

  const server = http.createServer(async (request, response) => {
    // You pass two more arguments for config and middleware
    // More details here: https://github.com/vercel/serve-handler#options
    const requestURL = new URL(request.url ?? "", "http://localhost:3000");

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

    if (request.url && request.url.search(/\/index-([a-z0-9]+)\.js/) > -1) {
      // Intercept the index.js bundle file and inject the kit code. THIS IS A HACK.
      response.writeHead(200, {
        "Content-Type": "application/javascript",
      });

      // Need to check this doesn't include "../" and other escape characters.
      const fileStream = createReadStream(`${distDir}${request.url}`);
      fileStream.pipe(response, { end: false });
      fileStream.on("end", () => {
        for (const kitName in kitOutput) {
          response.write(
            `// Kit (${kitName}) dynamically added from Server.\n`
          );
          response.write(kitOutput[kitName]);
          response.write("\n");
        }
        response.end();
      });
      return;
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
    console.log(
      `Running at http://localhost:3000/${
        fileUrl != undefined
          ? `?board=/${relative(process.cwd(), fileUrl.pathname)}`
          : ""
      }`
    );
  });
};
