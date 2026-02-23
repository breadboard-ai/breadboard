/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsonStringify } from "../../src/utils/formatting/json-stringify.js";

describe("jsonStringify", () => {
  it("returns the inner content of a JSON-stringified string", () => {
    assert.equal(jsonStringify("hello"), "hello");
  });

  it("escapes double quotes", () => {
    assert.equal(jsonStringify('say "hi"'), 'say \\"hi\\"');
  });

  it("escapes newlines", () => {
    assert.equal(jsonStringify("line1\nline2"), "line1\\nline2");
  });

  it("escapes tabs", () => {
    assert.equal(jsonStringify("a\tb"), "a\\tb");
  });

  it("escapes backslashes", () => {
    assert.equal(jsonStringify("a\\b"), "a\\\\b");
  });

  it("handles empty string", () => {
    assert.equal(jsonStringify(""), "");
  });

  it("handles unicode characters", () => {
    assert.equal(jsonStringify("café ☕"), "café ☕");
  });
});
