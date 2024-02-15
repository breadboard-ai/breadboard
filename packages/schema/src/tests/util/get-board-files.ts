/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import { getJsonFiles } from "./get-json-files.js";

export function getBoardFiles(directory: string) {
  return getJsonFiles(directory).filter((file: fs.PathOrFileDescriptor) => {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      return Array.isArray(data.edges) && Array.isArray(data.nodes);
    } catch (e) {
      return false;
    }
  });
}
