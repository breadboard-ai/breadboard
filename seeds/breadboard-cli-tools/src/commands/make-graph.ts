/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { watch } from 'fs';
import path from 'path';
import { loadBoardFromModule, resolveFilePath } from './lib/utils.js';

export const makeGraph = async (file: string, options: Record<string, string>) => {
  const filePath = resolveFilePath(file);

  if (file != undefined) {
    if (path.extname(file) != '.js') {
      throw new Error(`File ${file} is not a JavaScript file.`);
    }

    const controller = new AbortController();
    let board = await loadBoardFromModule(filePath);

    console.log(JSON.stringify(board, null, 2));

    if ('watch' in options) {
      watch(file, { signal: controller.signal }, async (eventType: string, filename: string | Buffer | null) => {
        if (typeof (filename) != 'string') return;

        if (eventType === 'change') {
          board = await loadBoardFromModule(filePath);

          console.log(JSON.stringify(board, null, 2));
        }
        else if (eventType === 'rename') {
          console.error(`File ${filename} has been renamed. We can't manage this yet. Sorry!`);
          controller.abort();
        }
      });
    }
  }
}