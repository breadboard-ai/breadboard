import { watch } from 'fs';
import path from 'path';
import { loadBoardFromModule, resolveFilePath } from './lib/utils.js';
import { Command } from 'commander';

export const makeGraph = async (file: string, options: Record<string, string>, command: Command) => {
  let filePath = resolveFilePath(file);

  if (file != undefined) {
    if (path.extname(file) != '.js') {
      throw new Error(`File ${file} is not a JavaScript file.`);
    }

    const controller = new AbortController();
    const board = await loadBoardFromModule(filePath);

    console.log(JSON.stringify(board, null, 2));

    if ('watch' in options) {
      watch(file, { signal: controller.signal }, async (eventType: string, filename: string | Buffer | null) => {
        if (typeof (filename) != 'string') return;

        if (eventType === 'change') {
          let board = await loadBoardFromModule(filePath);

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