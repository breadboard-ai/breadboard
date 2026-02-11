/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { equal, strictEqual } from "node:assert";
import { suite, test } from "node:test";
import {
  toNotebookLmUrl,
  parseNotebookLmId,
  isNotebookLmUrl,
} from "../../src/notebooklm.js";

suite("toNotebookLmUrl", () => {
  test("converts ID to full URL", () => {
    equal(
      toNotebookLmUrl("abc123"),
      "https://notebooklm.google.com/notebook/abc123"
    );
  });

  test("handles empty string", () => {
    equal(toNotebookLmUrl(""), "https://notebooklm.google.com/notebook/");
  });
});

suite("parseNotebookLmId", () => {
  test("extracts ID from valid URL", () => {
    equal(
      parseNotebookLmId("https://notebooklm.google.com/notebook/abc123"),
      "abc123"
    );
  });

  test("handles URL with complex ID", () => {
    equal(
      parseNotebookLmId(
        "https://notebooklm.google.com/notebook/a1b2-c3d4_e5f6"
      ),
      "a1b2-c3d4_e5f6"
    );
  });

  test("returns undefined for non-NLM URL", () => {
    strictEqual(
      parseNotebookLmId("https://example.com/notebook/abc123"),
      undefined
    );
  });

  test("returns undefined for empty string", () => {
    strictEqual(parseNotebookLmId(""), undefined);
  });

  test("returns undefined for partial prefix", () => {
    strictEqual(
      parseNotebookLmId("https://notebooklm.google.com/noteboo"),
      undefined
    );
  });

  test("returns empty string for URL ending at prefix", () => {
    equal(parseNotebookLmId("https://notebooklm.google.com/notebook/"), "");
  });
});

suite("isNotebookLmUrl", () => {
  test("returns true for valid NLM URL", () => {
    equal(
      isNotebookLmUrl("https://notebooklm.google.com/notebook/abc123"),
      true
    );
  });

  test("returns false for non-NLM URL", () => {
    equal(isNotebookLmUrl("https://example.com/notebook/abc123"), false);
  });

  test("returns false for empty string", () => {
    equal(isNotebookLmUrl(""), false);
  });

  test("returns false for partial prefix", () => {
    equal(isNotebookLmUrl("https://notebooklm.google.com/noteboo"), false);
  });

  test("returns true for URL with trailing path", () => {
    equal(
      isNotebookLmUrl("https://notebooklm.google.com/notebook/abc123/sources"),
      true
    );
  });
});
