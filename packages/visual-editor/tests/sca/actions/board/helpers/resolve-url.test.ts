/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  canParse,
  resolveUrl,
  addResourceKeyIfPresent,
} from "../../../../../src/sca/actions/board/helpers/resolve-url.js";

suite("resolve-url helpers", () => {
  suite("canParse", () => {
    test("returns true for valid absolute URL", () => {
      assert.strictEqual(canParse("https://example.com/board.json"), true);
    });

    test("returns true for valid relative URL with base", () => {
      assert.strictEqual(canParse("board.json", "https://example.com/"), true);
    });

    test("returns false for invalid URL", () => {
      // Empty string with no base should fail
      assert.strictEqual(canParse("", undefined), false);
    });
  });

  suite("resolveUrl", () => {
    test("returns null for null input", () => {
      assert.strictEqual(resolveUrl(null, null), null);
    });

    test("returns URL as-is when no current URL provided", () => {
      assert.strictEqual(
        resolveUrl("https://example.com/board.json", null),
        "https://example.com/board.json"
      );
    });

    test("resolves relative URL against current URL", () => {
      const result = resolveUrl(
        "https://example.com/other/board.json",
        "https://example.com/path/current.json"
      );
      assert.strictEqual(result, "https://example.com/other/board.json");
    });

    test("returns original URL when resolution fails", () => {
      // Passing a non-parseable URL as base
      const result = resolveUrl("board.json", "not-a-url");
      assert.strictEqual(result, "board.json");
    });
  });

  suite("addResourceKeyIfPresent", () => {
    test("returns original URL when no reference URL", () => {
      const url = "https://example.com/board.json";
      assert.strictEqual(addResourceKeyIfPresent(url, null), url);
    });

    test("returns original URL when reference has no resourcekey", () => {
      const url = "https://example.com/board.json";
      const ref = "https://other.com/page";
      assert.strictEqual(addResourceKeyIfPresent(url, ref), url);
    });

    test("adds resourcekey from reference URL", () => {
      const url = "https://example.com/board.json";
      const ref = "https://other.com/page?resourcekey=abc123";
      assert.strictEqual(
        addResourceKeyIfPresent(url, ref),
        "https://example.com/board.json?resourcekey=abc123"
      );
    });

    test("handles invalid reference URL gracefully", () => {
      const url = "https://example.com/board.json";
      assert.strictEqual(addResourceKeyIfPresent(url, "not-a-url"), url);
    });
  });
});
