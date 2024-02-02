/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path, { extname } from "path";
import { Loaders } from "./lib/loaders/index.js";
import { resolveFilePath, watch } from "./lib/utils.js";
import { MakeOptions } from "./commandTypes.js";

export const makeGraph = async (file: string, options: MakeOptions) => {
  const filePath = resolveFilePath(file);

  if (
    file != undefined &&
    path.extname(file) != ".js" &&
    path.extname(file) != ".ts"
  ) {
    throw new Error(`File ${file} must be a JavaScript or TypeScript file.`);
  }

  if (file != undefined) {
    const loaderType = extname(file).slice(1) as "js" | "ts" | "json";
    const loader = new Loaders(loaderType);

    let board = await loader.load(filePath, options);

    console.log(JSON.stringify(board, null, 2));

    if ("watch" in options) {
      watch(file, {
        onChange: async () => {
          board = await loader.load(filePath, options);

          console.log(JSON.stringify(board, null, 2));
        },
      });
    }
  }
};
