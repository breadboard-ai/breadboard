/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { join } from "path";
import { Case } from "./types";
import {
  access,
  constants,
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "fs/promises";

export { write, read, copy, exists, remove };

const OUT_DIR = join(import.meta.dirname, "../out");

type FileType = "draft" | "test" | "errors" | "final";

async function write(c: Case, type: FileType, contents: string) {
  const filename = join(OUT_DIR, `${c.name}${getSuffix(type)}`);
  await mkdir(OUT_DIR, { recursive: true });
  return writeFile(filename, contents, "utf-8");
}

async function read(c: Case, type: FileType) {
  const filename = join(OUT_DIR, `${c.name}${getSuffix(type)}`);
  return readFile(filename, "utf-8");
}

async function copy(c: Case, from: FileType, to: FileType) {
  const fromFile = join(OUT_DIR, `${c.name}${getSuffix(from)}`);
  const toFile = join(OUT_DIR, `${c.name}${getSuffix(to)}`);
  return copyFile(fromFile, toFile);
}

async function exists(c: Case, type: FileType) {
  try {
    return access(`${c.name}${getSuffix(type)}`, constants.F_OK);
  } catch {
    return false;
  }
}

async function remove(c: Case, type: FileType) {
  const filename = join(OUT_DIR, `${c.name}${getSuffix(type)}`);
  return rm(filename);
}

function getSuffix(type: FileType) {
  switch (type) {
    case "errors":
      return ".error.log";
    case "final":
      return ".js";
    default:
      return `.${type}.js`;
  }
}
