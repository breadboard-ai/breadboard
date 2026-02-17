/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { parseThought };
export type { ParsedThought };

/**
 * Parsed thought with optional title and body.
 */
type ParsedThought = {
  title: string | null;
  body: string;
};

/**
 * Parse a thought string to extract title (from **Title**) and body.
 */
function parseThought(text: string): ParsedThought {
  const match = text.match(/\*\*(.+?)\*\*/);
  if (!match) {
    return { title: null, body: text };
  }
  const title = match[1];
  const body = text.replace(match[0], "").trim();
  return { title, body };
}
