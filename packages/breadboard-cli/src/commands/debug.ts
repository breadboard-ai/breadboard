/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { watch } from "./lib/utils.js";
import { stat } from "fs/promises";
import { DebugOptions } from "./commandTypes.js";
import { startServer } from "./lib/debug-server.js";

export const __dirname = dirname(fileURLToPath(import.meta.url));

export const debug = async (file: string, options: DebugOptions) => {
  if (file == undefined) {
    // If the user doesn't provide a file, we should use the current working directory (which will load all files)
    file = process.cwd();
  }

  const outputDirectoryStat =
    "output" in options ? await stat(options.output) : undefined;

  options.root = path.parse(path.resolve(file)).dir;

  if (options.save && outputDirectoryStat?.isDirectory() == false) {
    console.error(
      `The defined output directory ${options.output} is not a directory.`
    );
    return process.exit(1);
  }

  if (options.save == false && outputDirectoryStat?.isDirectory()) {
    console.warn(
      `Files will not be output to defined output directory ${options.output} because the -n (no-save) flag was used.`
    );
  }

  if ("watch" in options) {
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

    watch(file, {
      onChange: async (filename: string) => {
        // Signal that the browser should reload - and it will refresh the boards
        console.log(`${filename} changed. Refreshing boards...`);

        notifyClients();
      },
      onRename: async () => {
        // Refresh the list of boards that are passed in at the start of the server.
        console.log(`Refreshing boards...`);

        notifyClients();
      },
    });
  }

  const { notifyClients } = await startServer(file, options);
};
