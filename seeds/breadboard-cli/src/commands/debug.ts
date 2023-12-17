/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { fileURLToPath, pathToFileURL } from "url";
import { stat, opendir, readFile } from "fs/promises";
import { createReadStream } from "fs";
import path, { join, dirname, relative } from "path";
import { watch } from "./lib/utils.js";
import handler from "serve-handler";
import http from "http";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));

type LocalBoard = { title: string; url: string; version: string };

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
        version: board.version ?? "0.0.1",
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
          ...board,
          title: board.title ?? join("/", path, dirent.name),
          url: join("/", path, dirent.name),
          version: board.version ?? "0.0.1",
        });
      }
    }
    return boards;
  }

  return [];
};

export const debug = async (file: string, options: Record<string, any>) => {
  const kitDeclarations = options.kit as string[] | undefined;
  const kitOutput: Record<string, string> = {};

  if (kitDeclarations != undefined) {
    // We should warn if we are importing code and the associated risks
    for (const kitDetail of kitDeclarations) {
      console.log(`Fetching kit ${kitDetail}...`);
      const output = await esbuild.build({
        bundle: true,
        format: "esm",
        platform: "node",
        tsconfig: path.join(process.cwd(), "..", "..", "tsconfig.json"),
        stdin: {
          resolveDir: process.cwd(),
          contents: `export * from "${kitDetail}";
          export { default } from "${kitDetail}";`,
        },
        write: false,
      });

      kitOutput[kitDetail] = Buffer.from(
        output.outputFiles[0].contents
      ).toString();
    }
  }

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
