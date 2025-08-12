/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function escape(str: string | null | undefined) {
  if (!str) {
    return "";
  }

  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return str.replace(/[&<>"']/gim, (char) => htmlEntities[char]);
}

export function unescape(str: string | null | undefined) {
  if (!str) {
    return "";
  }

  return str
    .replace(/&#39;/gim, "'")
    .replace(/&quot;/gim, '"')
    .replace(/&gt;/gim, ">")
    .replace(/&lt;/gim, "<")
    .replace(/&amp;/gim, "&");
}
