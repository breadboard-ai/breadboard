/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";

export function getJsonFiles(
  directory: string,
  ignorePatterns: string[] = [
    "node_modules",
    ".wireit",
    "dist",
    "build",
    "dist_test",
  ]
): string[] {
  const files = fs.readdirSync(directory);
  const jsonFiles = files
    .filter((file) => file.endsWith(".json"))
    .map((file) => `${directory}/${file}`);
  const directories = files
    .filter(
      (file) =>
        fs.statSync(`${directory}/${file}`).isDirectory() &&
        !ignorePatterns.includes(file)
    )
    .map((file) => `${directory}/${file}`);
  return jsonFiles.concat(
    directories.flatMap((dir) => getJsonFiles(dir, ignorePatterns))
  );
}
