/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";
import { readFile, readdir } from "fs/promises";

export default async (inputs: InputValues) => {
  if (!inputs["path"]) throw Error("No path input");

  const filenames = await readdir(inputs["path"] as string);

  const files = filenames.map(async (filename) => {
    const contents = await readFile(filename, "utf8");
    return { id: filename, text: contents };
  });

  return { documents: await Promise.all(files) };
};
