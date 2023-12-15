/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { stat } from "fs/promises";
import path from "path";
import { makeFromFile, resolveFilePath, watch } from "./lib/utils.js";

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
    let { boardJson } = await makeFromFile(filePath);

    console.log(boardJson, null, 2);

    if ("watch" in options) {
      watch(file, {
        onChange: async () => {
          ({ boardJson } = await makeFromFile(filePath));

          console.log(JSON.stringify(boardJson, null, 2));
        },
      });
    }
  }
};
