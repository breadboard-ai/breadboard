/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardRunner, GraphDescriptor } from "@google-labs/breadboard";
import { Dirent, watch as fsWatch } from "fs";
import { opendir, readFile, stat, writeFile, mkdir } from "fs/promises";
import { join } from "node:path";
import { stdin as input } from "node:process";
import * as readline from "node:readline/promises";
import path, { extname } from "path";
import { relative } from "path/posix";
import { URL, pathToFileURL } from "url";
import { Options } from "./loader.js";
import { Loaders } from "./loaders/index.js";
import { MakeOptions } from "../commandTypes.js";
import { formatGraphDescriptor } from "@google-labs/breadboard";

export const SERVER_PORT = parseInt(process.env.PORT || '') || 3000;
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;

export const defaultKits = [
  "@google-labs/palm-kit",
  "@google-labs/core-kit",
  "@google-labs/json-kit",
  "@google-labs/template-kit",
  "@google-labs/node-nursery-web",
  `/agent.kit.json`,
];

export type BoardMetaData = {
  title: string;
  url?: string;
  version: string;
  edges: Array<unknown>;
  nodes: Array<unknown>;
  kits: Array<unknown>;
};

export type WatchOptions = {
  onChange: (filename: string) => void;
  onRename?: (filename: string) => void;
  controller?: AbortController;
};

export const watch = (file: string, options: WatchOptions) => {
  let { controller, onChange, onRename } = options;

  onChange = onChange ?? (() => "");
  onRename =
    onRename ??
    ((filename) =>
      console.error(
        `File ${filename} has been renamed. We can't manage this yet. Sorry!`
      ));

  controller = controller ?? new AbortController();

  fsWatch(
    file,
    { signal: controller.signal, recursive: true },
    async (eventType: string, filename: string | Buffer | null) => {
      if (typeof filename != "string") return;

      if (eventType === "change") {
        onChange(filename);
      } else if (eventType === "rename") {
        if (onRename != undefined) {
          onRename(filename);
        }
      }
    }
  );
};

export const resolveFilePath = (file: string) => {
  return path.resolve(
    process.cwd(),
    path.join(path.dirname(file), path.basename(file))
  );
};

export const loadBoard = async (
  file: string,
  options: MakeOptions
): Promise<BoardRunner> => {
  const loaderType = extname(file).slice(1) as "js" | "ts" | "json";
  const save = "save" in options ? options["save"] : true;

  const loader = new Loaders(loaderType);
  const board = await loader.load(file, options);
  if (save) {
    let boardClone = JSON.parse(JSON.stringify(board));
    delete boardClone.url; // Boards shouldn't have URLs serialized.
    if (options.format) {
      boardClone = formatGraphDescriptor(boardClone);
    }
    const boardJson = JSON.stringify(boardClone, null, 2);

    // Most commands will pass in the output directory, but if they don't, we'll use the directory of the file being loaded.
    const outputFilePath = await resolveAndCreateOutputDirectory(options, file);
    await writeFile(outputFilePath, boardJson);
  }
  return board;
};

export const parseStdin = async (): Promise<string> => {
  let lines = "";
  const rl = readline.createInterface({ input });
  for await (const line of rl) {
    lines += line;
  }
  rl.close();
  return lines;
};

const showError = (e: unknown, path?: string) => {
  const error = e as Error;
  console.error(`Failed to load board at "${path}": ${error.message}`);
};

export const loadBoards = async (
  path: string,
  options: Options
): Promise<Array<BoardMetaData>> => {
  const fileStat = await stat(path);
  const fileUrl = pathToFileURL(path);

  if (fileStat && fileStat.isFile() && path.endsWith(".json")) {
    try {
      const data = await readFile(path, { encoding: "utf-8" });
      const board = JSON.parse(data) as GraphDescriptor; // assume conversion would fail if it wasn't a graph descriptor.

      return [
        {
          edges: board.edges ?? [],
          nodes: board.nodes ?? [],
          kits: board.kits ?? [],
          title: board.title ?? path,
          url: join("/", relative(process.cwd(), path)),
          version: board.version ?? "0.0.1",
        },
      ];
    } catch (e) {
      showError(e, path);
    }
  }

  if (
    fileStat &&
    fileStat.isFile() &&
    (path.endsWith(".js") || path.endsWith(".ts") || path.endsWith(".json"))
  ) {
    try {
      // Compile the JS or TS.
      const board = await loadBoard(path, options);

      return [
        {
          ...board,
          title: board.title ?? path,
          url: join("/", relative(process.cwd(), path)),
          version: board.version ?? "0.0.1",
        },
      ];
    } catch (e) {
      showError(e, path);
    }
  }

  if (fileStat && fileStat.isDirectory()) {
    return await loadBoardsFromDirectory(fileUrl, path, options);
  }

  return [];
};

const getFilename = (dirent: Dirent) => {
  const { path: maybePath, name } = dirent;
  // In Node v20.5.0 and earlier, the name is included in path
  // In Node v20.6.0 and later, the name is not included in path
  return maybePath.endsWith(name) ? maybePath : join(maybePath, name);
};

async function resolveAndCreateOutputDirectory(options: Options, file: string) {
  const outputRoot =
    "output" in options ? options["output"] : path.dirname(file);
  const inputBaseDirectory = options.root
    ? path.resolve(options.root)
    : path.dirname(file);

  const pathInfo = path.parse(file);
  const fullOutputRootPath = path.resolve(outputRoot);
  const inputRoot = path.relative(inputBaseDirectory, pathInfo.dir);
  const base = path.join(fullOutputRootPath, inputRoot);
  const outputFilePath = path.join(base, `${pathInfo.name}.json`);
  await mkdir(base, { recursive: true });
  return outputFilePath;
}

async function loadBoardsFromDirectory(
  fileUrl: URL,
  path: string,
  options: Options
) {
  const dir = await opendir(fileUrl);
  const boards: Array<BoardMetaData> = [];
  for await (const dirent of dir) {
    const name = dirent.name;
    if (
      dirent.isFile() &&
      (name.endsWith(".js") || name.endsWith(".ts") || name.endsWith(".json"))
    ) {
      const filename = getFilename(dirent);
      try {
        const board = await loadBoard(filename, options);
        boards.push({
          ...board,
          title: board.title ?? name,
          url: `/${name}`,
          version: board.version ?? "0.0.1",
        });
      } catch (e) {
        showError(e, filename);
      }
    }

    if (dirent.isDirectory()) {
      const baseFolder = fileUrl.pathname.endsWith("/")
        ? fileUrl.pathname
        : `${fileUrl.pathname}/`;
      const boardsInDir = await loadBoardsFromDirectory(
        new URL(dirent.name, pathToFileURL(baseFolder)),
        join(path, dirent.name),
        options
      );
      boards.push(...boardsInDir);
    }
  }
  return boards;
}
