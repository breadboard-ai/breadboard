/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from '@google-labs/breadboard';
import { readFile } from 'fs/promises';
import path from "path";
import * as readline from 'node:readline/promises';
import { stdin as input } from 'node:process';

export const loadBoardFromModule = async (file: string) => {
  const board = (await import(file)).default;

  if (board == undefined) throw new Error(`Board ${file} does not have a default export`);

  if (board instanceof Board == false) throw new Error(`Board ${file} does not have a default export of type Board`);

  return board;
};

export const resolveFilePath = (file: string) => {
  return path.resolve(
    process.cwd(),
    path.join(path.dirname(file), path.basename(file))
  );
};

export const loadBoard = async (file: string) => {
  const fileContents = await readFile(file, 'utf-8');
  const board = await Board.fromGraphDescriptor(JSON.parse(fileContents));
  return board;
};

export const parseStdin = async (): Promise<string> => {
  let lines = ""
  const rl = readline.createInterface({ input });
  for await (const line of rl) {
    lines += line;
  }
  rl.close();
  return lines;
};
