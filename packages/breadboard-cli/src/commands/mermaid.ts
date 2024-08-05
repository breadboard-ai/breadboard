/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { toMermaid } from "@google-labs/breadboard";
import { loadBoard, parseStdin, resolveFilePath, watch } from "./lib/utils.js";
import { MermaidOptions } from "./commandTypes.js";

export const mermaid = async (file: string, options: MermaidOptions) => {
  if (file != undefined) {
    const filePath = resolveFilePath(file);
    let board = await loadBoard(filePath, options);

    if (!board) {
      return;
    }

    console.log(toMermaid(board));

    if ("watch" in options) {
      watch(file, {
        onChange: async () => {
          board = await loadBoard(filePath, options);
          if (!board) {
            return;
          }
          console.log(toMermaid(board));
        },
      });
    }
  } else {
    const stdin = await parseStdin();

    // TODO: What do we do if it's typescript?
    // We should validate it looks like a board...
    const board = JSON.parse(stdin);

    console.log(toMermaid(board));
  }
};
