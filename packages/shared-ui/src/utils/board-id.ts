/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const ARG_NAME = "tab0";

/**
 * Extract the board ID from a breadboard URL.
 */
export function getBoardIdFromUrl(url: URL): string | null {
  const params = new URLSearchParams(url.search);
  return params.get(ARG_NAME);
}
