/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import mime from "mime";

export { getFileHandle, write };

let fileCount = 0;

const KNOWN_TYPES = ["audio", "video", "image"];

function getFileHandle(ext: string) {
  return `/vfs/video${++fileCount}${ext}`;
}

async function write(_data: unknown, mimeType: string) {
  const name = getFilename(mimeType);
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
