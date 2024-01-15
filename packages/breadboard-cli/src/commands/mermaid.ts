/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardRunner } from "@google-labs/breadboard";
import { loadBoard, parseStdin, resolveFilePath, watch } from "./lib/utils.js";
import { MermaidOptions } from "./commandTypes.js";

export const mermaid = async (file: string, options: MermaidOptions) => {
  if (file != undefined) {
    const filePath = resolveFilePath(file);
    let board = await loadBoard(filePath, options);

    console.log(board.mermaid());

    if ("watch" in options) {
      watch(file, {
        onChange: async () => {
          board = await loadBoard(filePath, options);
          console.log(board.mermaid());
        },
      });
    }
  } else {
    const stdin = await parseStdin();

    // TODO: What do we do if it's typescript?
    // We should validate it looks like a board...
    const board = await BoardRunner.fromGraphDescriptor(JSON.parse(stdin));

    console.log(board.mermaid());
  }
};
