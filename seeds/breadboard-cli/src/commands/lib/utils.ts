/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, BoardRunner, GraphDescriptor } from "@google-labs/breadboard";
import * as esbuild from "esbuild";
import { watch as fsWatch } from "fs";
import { opendir, readFile, stat, unlink, writeFile } from "fs/promises";
import { join } from "node:path";
import { stdin as input } from "node:process";
import * as readline from "node:readline/promises";
import path, { basename } from "path";
import { relative } from "path/posix";
import { pathToFileURL } from "url";
import vm from "node:vm";

export type Options = {
  output?: string;
  watch?: boolean;
};

export type BoardMetaData = {
  title: string;
  url: string;
  version: string;
  edges: Array<unknown>;
  nodes: Array<unknown>;
  kits: Array<unknown>;
};

export async function makeFromSource(
  filename: string,
  source: string,
  options?: Options
) {
  const board = await loadBoardFromSource(filename, source, options);
  const boardJson = JSON.stringify(board, null, 2);
  return { boardJson, board };
}

export async function makeFromFile(filePath: string) {
  const board = await loadBoardFromModule(
    path.resolve(process.cwd(), filePath)
  );
  const boardJson = JSON.stringify(board, null, 2);
  return { boardJson, board };
}

const boardLike = (
  board: Record<string, unknown>
): board is GraphDescriptor => {
  return board && "edges" in board && "nodes" in board;
};

export const loadBoardFromModule = async (file: string) => {
  // This will leak. Look for other hot reloading solutions.
  let board = (await import(`${file}?${Date.now()}`)).default;

  if (board == undefined)
    throw new Error(`Board ${file} does not have a default export`);

  if (boardLike(board)) {
    // A graph descriptor has been exported.. Possibly a lambda.
    board = await Board.fromGraphDescriptor(board);
  }
  if (board instanceof Board == false && board instanceof BoardRunner == false)
    throw new Error(
      `Board ${file} does not have a default export of type Board, Lambda or something that looks like a board.`
    );

  return board;
};

/* 
  If we are loading from Source (TS) then we need to compile it and output it to a place where there are unlikely to be any collisions.
*/
export const loadBoardFromSource = async (
  filename: string,
  source: string,
  options?: Options
) => {
  const tmpDir = options?.output ?? process.cwd();
  const filePath = join(tmpDir, `~${basename(filename, "ts")}tmp.mjs`);

  let tmpFileStat;
  try {
    tmpFileStat = await stat(filePath);
  } catch (e) {
    // Don't care if the file doesn't exist. It's fine. It's what we want.
    ("Nothing to see here. Just don't want to have to re-throw.");
  }

  if (tmpFileStat && tmpFileStat.isFile()) {
    // Don't write to a file.
    throw new Error(
      `The temporary file ${filePath} already exists. We can't write to it.`
    );
  }

  if (tmpFileStat && tmpFileStat.isSymbolicLink()) {
    // Don't write to a symbolic link.
    throw new Error(
      `The file ${filePath} is a symbolic link. We can't write to it.`
    );
  }

  // I heard it might be possible to do a symlink hijack. double check.
  await writeFile(filePath, source);

  // For the import to work it has to be relative to the current working directory.
  const board = await loadBoardFromModule(
    path.resolve(process.cwd(), filePath)
  );

  // remove the file
  await unlink(filePath);

  return board;
};

type WatchOptions = {
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
  if (file.endsWith(".ts")) {
    const fileContents = await readFile(file, "utf-8");
    const result = await esbuild.transform(fileContents, { loader: "ts" });
    const { board } = await makeFromSource(file, result.code, options);
    return board;
  } else if (file.endsWith(".js")) {
    const { board } = await makeFromFile(file);
    return board;
  } else {
    const fileContents = await readFile(file, "utf-8");
    const board = await Board.fromGraphDescriptor(JSON.parse(fileContents));
    return board;
  }
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
  path: string
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
    (path.endsWith(".js") || path.endsWith(".ts"))
  ) {
    // Compile the JS
    const board = await loadBoard(path, { watch: false });

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
        (dirent.name.endsWith(".js") || dirent.name.endsWith(".ts"))
      ) {
        const board = await loadBoard(dirent.path, { watch: false });
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
