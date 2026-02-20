/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Zero-Width No-Break Space. Used as an invisible cursor-landing pad
 * around chiclets so the browser always has a text node to place the
 * caret in.
 */
export const ZWNBSP = "\uFEFF";

/**
 * Regex that matches all ZWNBSP characters globally.
 * Reused across selection offset computations.
 */
export const ZWNBSP_RE = /\uFEFF/g;

/**
 * Strip ZWNBSP characters from a string, returning only visible text.
 */
export function stripZWNBSP(text: string): string {
  return text.replace(ZWNBSP_RE, "");
}
