/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, writeFile } from "fs/promises";
import mime from "mime";
import { join } from "path";

export { getFileHandle, write };

let fileCount = 0;

const KNOWN_TYPES = ["audio", "video", "image"];

const OUT_DIR = join(import.meta.dirname, "../out");

function getFileHandle(ext: string) {
  return `/vfs/video${++fileCount}${ext}`;
}

async function write(buffer: Buffer<ArrayBuffer>, mimeType: string) {
  await mkdir(OUT_DIR, { recursive: true });
  const name = getFilename(mimeType);
  await writeFile(join(OUT_DIR, name), buffer);
  return `/vfs/${name}`;
}

function getFilename(mimeType: string) {
  const name = getName(mimeType);
  const ext = mime.getExtension(mimeType);
  return `${name}${++fileCount}.${ext}`;
}

function getName(mimeType: string) {
  const first = mimeType.split("/").at(0) || "";
  if (KNOWN_TYPES.includes(first)) return first;
  return "file";
}
