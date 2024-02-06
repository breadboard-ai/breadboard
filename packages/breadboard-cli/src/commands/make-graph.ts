/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import { stat } from "fs/promises";
import { loadBoards, loadBoard, resolveFilePath, watch } from "./lib/utils.js";
import { MakeOptions } from "./commandTypes.js";
import { Stats } from "fs";

export const makeGraph = async (file: string, options: MakeOptions) => {
  if (file == undefined) {
    // If the user doesn't provide a file, we should use the current working directory (which will load all files)
    file = process.cwd();
  }

  const inputFileStat = await stat(file);

  const outputDirectoryStat =
    "output" in options ? await stat(options.output) : undefined;

  options.root = path.parse(path.resolve(file)).dir;

  if (outputDirectoryStat?.isDirectory() == false) {
    console.error(
      `The defined output directory ${options.output} is not a directory.`
    );
    return process.exit(1);
  }

  if (file != undefined) {
    const filePath = resolveFilePath(file);

    if (inputFileStat.isDirectory()) {
      // If the input is a directory, we should load all the boards in the directory and save them.
      options.save = true;
      const relative = path.relative(file, options.output);
      const isOutputDirectoryContainedWithin =
        relative === "" ||
        (relative && !relative.startsWith("..") && !path.isAbsolute(relative));
      if (options.save && isOutputDirectoryContainedWithin) {
        console.error(
          `The output directory ${options.output} must be outside of the file or directory being watched. Specify a different output directory with the -o flag.`
        );
        return process.exit(1);
      }

      await loadBoards(filePath, options);
    } else if (path.extname(file) == ".js" || path.extname(file) == ".ts") {
      const board = await loadBoard(filePath, options);
      if (options.save == false) {
        console.log(JSON.stringify(board, null, 2));
      }
    } else {
      throw new Error(`File ${file} must be a JavaScript or TypeScript file.`);
    }

    if ("watch" in options) {
      watch(file, {
        onChange: async () => {
          if (inputFileStat?.isDirectory()) {
            options.save = true;
            await loadBoards(filePath, options);
          } else {
            await loadBoard(filePath, options);
          }
        },
      });
    }
  }
};
