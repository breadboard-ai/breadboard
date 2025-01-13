/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gemini requires [a-zA-Z0-9_\-\.]{1,63}
 * OpenAI requires [a-zA-Z0-9_\-]{1,??}
 */
export function makeToolSafeName(path: string) {
  return path.replace(/[^a-zA-Z0-9_\\-]/g, "_").slice(0, 63);
}
