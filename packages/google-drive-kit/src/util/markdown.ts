/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Cursor,
  ParsedBullet,
  ParsedHeading,
  ParsedLine,
} from "./types.js";

export { parseMarkdown };

/**
 * Super-naive Markdown parser.
 */
function parseMarkdown(text: string): ParsedLine[] {
  const lines = text.split(/\n/);
  const result: ParsedLine[] = [];
  const cursor: Cursor = { pos: 0 };
  lines
    .map((line) => line.trimEnd())
    .forEach((line) => {
      if (!line) {
        return;
      }
      const heading = parseHeading(cursor, line);
      if (heading) {
        result.push(heading);
        return;
      }
      const bullet = parseBullet(cursor, line);
      if (bullet) {
        result.push(bullet);
        return;
      }
      result.push({
        type: "text",
        text: line,
        ...updateCursor(cursor, line.length),
      });
    });
  return result;
}

function updateCursor(
  cursor: Cursor,
  len: number
): { start: number; end: number } {
  const start = cursor.pos;
  const end = (cursor.pos += len) - 1;
  return { start, end };
}

function parseHeading(cursor: Cursor, line: string): ParsedHeading | null {
  const match = line.match(/^(?<heading>#{1,6})\s+(?<text>.+)$/);
  if (!match) {
    return null;
  }
  const heading = match.groups?.heading?.trim();
  const text = match.groups?.text?.trim();
  if (!heading || text === undefined) {
    return null;
  }
  return {
    type: "heading",
    level: heading.length,
    text,
    ...updateCursor(cursor, text.length),
  };
}

function parseBullet(cursor: Cursor, line: string): ParsedBullet | null {
  const match = line.match(/^(?<indent>\s*)[-+*]\s+(?<text>.+)$/);
  if (!match) {
    return null;
  }
  const indent = match?.groups?.indent;
  const text = match?.groups?.text?.trim();
  if (indent === undefined || text === undefined) {
    return null;
  }
  return {
    type: "bullet",
    level: indent.length,
    text,
    ...updateCursor(cursor, text.length),
  };
}
