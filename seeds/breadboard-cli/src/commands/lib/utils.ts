/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, BoardRunner } from "@google-labs/breadboard";
import * as esbuild from "esbuild";
import { readFile, stat, unlink, writeFile } from "fs/promises";
import { join } from "node:path";
import { stdin as input } from "node:process";
import * as readline from "node:readline/promises";
import path, { basename } from "path";
import { watch as fsWatch } from "fs";

export type Options = {
  output?: string;
  watch?: boolean;
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

export async function makeFromFile(filePath: string, options?: Options) {
  const board = await loadBoardFromModule(filePath);
  const boardJson = JSON.stringify(board, null, 2);
  return { boardJson, board };
}

export const loadBoardFromModule = async (file: string) => {
  console.log(file);

  // This will leak. Look for other hot reloading solutions.
  const board = (await import(`${file}?${Date.now()}`)).default;

  if (board == undefined)
    throw new Error(`Board ${file} does not have a default export`);

  if (board instanceof Board == false)
    throw new Error(
      `Board ${file} does not have a default export of type Board`
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
    ("Nothing to see here. Just don't want to have to re-throw.");
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
