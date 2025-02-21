/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function isEmbedUri(uri: string | null): boolean {
  if (!uri) {
    return false;
  }

  return /^https:\/\/www\.youtube\.com\/embed\//.test(uri);
}

export function isWatchUri(uri: string): boolean {
  return /^https:\/\/www\.youtube\.com\/watch\?v=/.test(uri);
}

export function convertWatchUriToEmbedUri(uri: string) {
  const regex =
    /^https:\/\/www\.youtube\.com\/(?:embed\/|watch\?v=)(.*?)(?:[&\\?]|$)/;
  const matches = regex.exec(uri);
  if (!matches) {
    return null;
  }

  const embedId = matches[1];
  return `https://www.youtube.com/embed/${embedId}`;
}
