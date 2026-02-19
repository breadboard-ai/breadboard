/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { extractStringValue } from "../src/a2ui/0.8/ui/utils/utils.js";

suite("extractStringValue", () => {
  test("returns empty string for null input", () => {
    assert.strictEqual(extractStringValue(null, null, null, null), "");
  });

  test("returns literalString value", () => {
    assert.strictEqual(
      extractStringValue({ literalString: "hello" }, null, null, null),
      "hello"
    );
  });

  test("returns literal value", () => {
    assert.strictEqual(
      extractStringValue({ literal: "hello" }, null, null, null),
      "hello"
    );
  });

  test("unescapes literal \\n sequences", () => {
    assert.strictEqual(
      extractStringValue(
        { literalString: "Hello\\n\\nWorld" },
        null,
        null,
        null
      ),
      "Hello\n\nWorld"
    );
  });

  test("unescapes literal \\t sequences", () => {
    assert.strictEqual(
      extractStringValue({ literalString: "col1\\tcol2" }, null, null, null),
      "col1\tcol2"
    );
  });

  test("unescapes literal \\r sequences", () => {
    assert.strictEqual(
      extractStringValue(
        { literalString: "line1\\r\\nline2" },
        null,
        null,
        null
      ),
      "line1\r\nline2"
    );
  });

  test("unescapes mixed sequences", () => {
    assert.strictEqual(
      extractStringValue(
        { literalString: "a\\nb\\tc\\r\\nd" },
        null,
        null,
        null
      ),
      "a\nb\tc\r\nd"
    );
  });

  test("passes through strings without escapes unchanged", () => {
    assert.strictEqual(
      extractStringValue(
        { literalString: "no escapes here" },
        null,
        null,
        null
      ),
      "no escapes here"
    );
  });

  test("unescapes in literal (not just literalString)", () => {
    assert.strictEqual(
      extractStringValue({ literal: "Hello\\nWorld" }, null, null, null),
      "Hello\nWorld"
    );
  });
});
