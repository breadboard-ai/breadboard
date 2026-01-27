/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import mime from "mime";

export { getMimeTypeMapping };

const CONVERSION_MAP = new Map([
  // --- Google Docs ---
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.google-apps.document",
  ],
  ["application/msword", "application/vnd.google-apps.document"],
  ["application/rtf", "application/vnd.google-apps.document"],
  ["text/plain", "application/vnd.google-apps.document"],
  [
    "application/vnd.oasis.opendocument.text",
    "application/vnd.google-apps.document",
  ],
  ["application/pdf", "application/vnd.google-apps.document"],
  // OCR Triggers here
  ["image/jpeg", "application/vnd.google-apps.document"],
  ["image/png", "application/vnd.google-apps.document"],
  ["image/gif", "application/vnd.google-apps.document"],
  ["image/bmp", "application/vnd.google-apps.document"],

  // --- Google Sheets ---
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.google-apps.spreadsheet",
  ],
  ["application/vnd.ms-excel", "application/vnd.google-apps.spreadsheet"],
  ["text/csv", "application/vnd.google-apps.spreadsheet"],
  ["text/tab-separated-values", "application/vnd.google-apps.spreadsheet"],
  [
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.google-apps.spreadsheet",
  ],

  // --- Google Slides ---
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.google-apps.presentation",
  ],
  ["application/vnd.ms-powerpoint", "application/vnd.google-apps.presentation"],
  [
    "application/vnd.oasis.opendocument.presentation",
    "application/vnd.google-apps.presentation",
  ],
]);

type DriveMimeMapping = {
  sourceMime: string;
  targetMime: string;
};

function getMimeTypeMapping(
  filename: string,
  shouldConvert: boolean
): DriveMimeMapping {
  const sourceMime = mime.getType(filename) || "application/octet-stream";

  let targetMime = sourceMime;
  if (shouldConvert && CONVERSION_MAP.has(sourceMime)) {
    targetMime = CONVERSION_MAP.get(sourceMime)!;
  }

  return { sourceMime, targetMime };
}
