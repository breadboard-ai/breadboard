/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const ARG_NAME = "tab0";

/**
 * Extract the board URL from a current window HTTP/HTTPS URL.
 *
 * Note that the board URL here may not be a HTTP/HTTPS URL - it could
 * be a Drive URL of the form drive:/12345.
 */
export function getBoardUrlFromCurrentWindow(): string | null {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  return params.get(ARG_NAME);
}
