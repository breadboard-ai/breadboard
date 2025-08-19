/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataPart,
  InlineDataCapabilityPart,
  Outcome,
  OutputValues,
} from "@breadboard-ai/types";
import { isLLMContentArray } from "./common.js";
import { createZip } from "littlezipper";

export { saveOutputsAsFile, extensionFromMimeType };

const COMMON_FILE_EXTENSIONS: ReadonlyMap<string, string> = new Map([
  ["text/plain", "txt"],
  ["text/html", "html"],
  ["text/css", "css"],
  ["text/javascript", "js"],
  ["text/csv", "csv"],
  ["text/xml", "xml"],
  ["text/markdown", "md"],
  ["application/json", "json"],
  ["application/ld+json", "jsonld"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["audio/mpeg", "mp3"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["application/pdf", "pdf"],
]);

function extensionFromMimeType(mimeType: string): string {
  if (!mimeType) {
    return "";
  }
  const normalizedMimeType = mimeType.toLowerCase().split(";")[0].trim();
  return COMMON_FILE_EXTENSIONS.get(normalizedMimeType) || "";
}

type FileData = InlineDataCapabilityPart["inlineData"];

async function saveOutputsAsFile(
  outputs: OutputValues
): Promise<Outcome<Blob>> {
  const parts: DataPart[] = [];
  for (const value of Object.values(outputs)) {
    if (isLLMContentArray(value)) {
      for (const content of value) {
        parts.push(...content.parts);
      }
    } else {
      parts.push({ text: JSON.stringify(value) });
    }
  }
  const files: FileData[] = [];
  for (const part of parts) {
    if ("text" in part) {
      files.push({ mimeType: "text/markdown", data: part.text });
    } else if ("inlineData" in part) {
      files.push(part.inlineData);
    }
  }
  if (files.length === 1) {
    // just save one file
    const file = files[0];
    return new Blob([encode(file)], { type: file.mimeType });
  }
  const zip = await createZip(
    files.map((file, index) => ({
      path: getFilename(file.mimeType, index + 1),
      data: encode(file),
    }))
  );
  return new Blob([new Uint8Array(zip.buffer as ArrayBuffer)], {
    type: "application/zip",
  });
}

function getFilename(mimeType: string, index: number) {
  return `file-${index}.${extensionFromMimeType(mimeType)}`;
}

function encode(file: FileData) {
  const { mimeType: type, data } = file;
  if (type.startsWith("text/")) {
    return data;
  }
  return b64toBlob(data);
}

function b64toBlob(s: string) {
  const binaryString = atob(s);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
