/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { canLoad } from "../../../../../src/sca/actions/board/helpers/load-graph.js";

suite("load-graph helpers", () => {
  suite("canLoad", () => {
    test("returns canLoad: true for valid URL", () => {
      const result = canLoad("https://example.com/board.json", null);
      assert.strictEqual(result.canLoad, true);
      if (result.canLoad) {
        assert.strictEqual(
          result.urlWithResourceKey,
          "https://example.com/board.json"
        );
      }
    });

    test("adds resourcekey from reference URL", () => {
      const result = canLoad(
        "https://example.com/board.json",
        "https://other.com/page?resourcekey=abc123"
      );
      assert.strictEqual(result.canLoad, true);
      if (result.canLoad) {
        assert.strictEqual(
          result.urlWithResourceKey,
          "https://example.com/board.json?resourcekey=abc123"
        );
      }
    });

    test("returns canLoad: false for invalid URL", () => {
      // Empty string with no base should fail
      const result = canLoad("", null);
      assert.strictEqual(result.canLoad, false);
      if (!result.canLoad) {
        assert.strictEqual(result.reason, "invalid-url");
      }
    });
  });

  // Note: loadGraph itself is harder to unit test as it requires
  // mocking the loader and signin adapter. Those tests should be
  // integration tests or use proper mocking infrastructure.
});
