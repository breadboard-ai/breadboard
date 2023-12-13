/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { fileURLToPath, pathToFileURL } from "url";
import { stat, opendir, readFile } from "fs/promises";
import { createReadStream } from "fs";
import { join, dirname, relative } from "path";
import { watch } from "./lib/utils.js";
import handler from "serve-handler";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));

type LocalBoard = { title: string; url: string };

const getBoards = async (path: string): Promise<Array<LocalBoard>> => {
  const fileStat = await stat(path);
  const fileUrl = pathToFileURL(path);

  if (fileStat && fileStat.isFile() && path.endsWith(".json")) {
    const data = await readFile(path, { encoding: "utf-8" });
    const board = JSON.parse(data);

    if ("title" in board == false) return [];

    return [
      {
        title: board.title,
        url: join("/", relative(process.cwd(), path)),
      },
    ];
  }

  if (fileStat && fileStat.isDirectory()) {
    const dir = await opendir(fileUrl);
    const boards: Array<LocalBoard> = [];
    for await (const dirent of dir) {
      if (dirent.isFile() && dirent.name.endsWith(".json")) {
        const data = await readFile(dirent.path, { encoding: "utf-8" });
        const board = JSON.parse(data);
        boards.push({
          title: board.title ?? join("/", path, dirent.name),
          url: join("/", path, dirent.name),
        });
      }
    }
    return boards;
  }

  return [];
};

export const debug = async (file: string) => {
  if (file == undefined) {
    file = process.cwd();
  }

  const fileUrl = pathToFileURL(file);

  let boards: Array<LocalBoard> = [];

  const distDir = join(__dirname, "..", "..", "ui");

  watch(file, {
    onChange: async (filename: string) => {
      // Refresh the list of boards that are passed in at the start of the server.
      console.log(`${filename} changed. Refreshing boards...`);
      boards = await getBoards(file);
    },
    onRename: async () => {
      // Refresh the list of boards that are passed in at the start of the server.
      console.log(`Refreshing boards...`);
      boards = await getBoards(file);
    },
  });

  const server = http.createServer(async (request, response) => {
    // You pass two more arguments for config and middleware
    // More details here: https://github.com/vercel/serve-handler#options
    const requestURL = new URL(request.url ?? "", "http://localhost:3000");

    if (requestURL.pathname === "/local-boards.json") {
      // Generate a list of boards that are valid at runtime.
      // Cache until things change.
      boards = await getBoards(file);

      const boardsData = JSON.stringify(boards);
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": boardsData.length,
      });

      return response.end(boardsData);
    }

    const board = boards.find((board) => board.url == requestURL.pathname);

    // We only want to serve the file that is being debugged... nothing else.
    if (board) {
      const boardData = JSON.stringify(board);
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": boardData.length,
      });

      const readStream = createReadStream(file);
      readStream.pipe(response);
      return;
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
