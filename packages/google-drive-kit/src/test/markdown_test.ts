/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { parseMarkdown } from "../util/markdown.js";
import { deepStrictEqual } from "node:assert";
import type { ParsedLine } from "../util/types.js";

describe("Markdown Parser", () => {
  test("parses simple text", () => {
    const actual = parseMarkdown("Test");
    const expected: ParsedLine[] = [
      { type: "text", text: "Test", start: 0, end: 3 },
    ];
    deepStrictEqual(actual, expected);
  });

  test("parses text with bullets", () => {
    {
      const actual = parseMarkdown("Test\n- Bullet");
      const expected: ParsedLine[] = [
        { type: "text", text: "Test", start: 0, end: 3 },
        { type: "bullet", level: 0, text: "Bullet", start: 4, end: 9 },
      ];
      deepStrictEqual(actual, expected);
    }
    {
      const actual = parseMarkdown(`Test\n- Bullet 1\n - Bullet 2`);
      const expected: ParsedLine[] = [
        { type: "text", text: "Test", start: 0, end: 3 },
        { type: "bullet", level: 0, text: "Bullet 1", start: 4, end: 11 },
        { type: "bullet", level: 1, text: "Bullet 2", start: 12, end: 19 },
      ];
      deepStrictEqual(actual, expected);
    }
  });

  test("skips empty lines", () => {
    const actual = parseMarkdown("\n\nTest\n\n");
    const expected: ParsedLine[] = [
      { type: "text", text: "Test", start: 0, end: 3 },
    ];
    deepStrictEqual(actual, expected);
  });

  test("parses headings", () => {
    const actual = parseMarkdown("# Heading 1\n## Heading 2\nText");
    const expected: ParsedLine[] = [
      { type: "heading", level: 1, text: "Heading 1", start: 0, end: 8 },
      { type: "heading", level: 2, text: "Heading 2", start: 9, end: 17 },
      { type: "text", text: "Text", start: 18, end: 21 },
    ];
    deepStrictEqual(actual, expected);
  });
});
