/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardRunner, GraphDescriptor } from "@google-labs/breadboard";
import { watch as fsWatch } from "fs";
import { opendir, readFile, stat, writeFile } from "fs/promises";
import { join } from "node:path";
import { stdin as input } from "node:process";
import * as readline from "node:readline/promises";
import path, { extname } from "path";
import { relative } from "path/posix";
import { pathToFileURL } from "url";
import { Options } from "./loader.js";
import { Loaders } from "./loaders/index.js";

export type BoardMetaData = {
  title: string;
  url: string;
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
  options: Options
): Promise<BoardRunner> => {
  const loaderType = extname(file).slice(1) as "js" | "ts" | "yaml" | "json";
  const save = "save" in options ? options["save"] : true;

  const loader = new Loaders(loaderType);
  const board = await loader.load(file, options);
  if (save && loaderType !== "json") {
    const pathInfo = path.parse(file);
    const boardClone = JSON.parse(JSON.stringify(board));
    const outputFilePath = path.join(options.output, `${pathInfo.name}.json`);
    boardClone.url = pathToFileURL(outputFilePath); // So that the base url is correct for subsequent invokes
    const boardJson = JSON.stringify(boardClone, null, 2);
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

export const loadBoards = async (
  path: string,
  options: Options
): Promise<Array<BoardMetaData>> => {
  const fileStat = await stat(path);
  const fileUrl = pathToFileURL(path);

  if (fileStat && fileStat.isFile() && path.endsWith(".json")) {
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
  }

  if (
    fileStat &&
    fileStat.isFile() &&
    (path.endsWith(".js") || path.endsWith(".ts") || path.endsWith(".yaml"))
  ) {
    // Compile the JS, TS or YAML.
    const board = await loadBoard(path, options);

    return [
      {
        ...board,
        title: board.title ?? path,
        url: join("/", relative(process.cwd(), path)),
        version: board.version ?? "0.0.1",
      },
    ];
  }

  if (fileStat && fileStat.isDirectory()) {
    const dir = await opendir(fileUrl);
    const boards: Array<BoardMetaData> = [];
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

      if (
        dirent.isFile() &&
        (dirent.name.endsWith(".js") ||
          dirent.name.endsWith(".ts") ||
          dirent.name.endsWith(".yaml"))
      ) {
        const board = await loadBoard(dirent.path, options);
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
