/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { stat } from "fs/promises";
import path, { extname } from "path";
import { Loaders } from "./lib/loaders/index.js";
import { resolveFilePath, watch } from "./lib/utils.js";

export const makeGraph = async (
  file: string,
  options: Record<string, string>
) => {
  const filePath = resolveFilePath(file);

  if (
    file != undefined &&
    path.extname(file) == ".ts" &&
    "output" in options == false
  ) {
    throw new Error(
      `File ${file} is not a TypeScript file. You must specify the output directory with --output.`
    );
  }

  if (file != undefined && path.extname(file) == ".ts" && options["output"]) {
    const fullDirPath = path.resolve(process.cwd(), options["output"]);
    const dirStat = await stat(fullDirPath);
    if (dirStat.isDirectory() == false) {
      throw new Error(
        `The path specified by ${options["output"]} is not a directory.`
      );
    }
  }

  if (
    file != undefined &&
    path.extname(file) != ".js" &&
    path.extname(file) != ".ts"
  ) {
    throw new Error(`File ${file} must be JavaScript or a TypeScript file.`);
  }

  if (file != undefined) {
    const loaderType = extname(file).slice(1) as "js" | "ts" | "yaml" | "json";
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
