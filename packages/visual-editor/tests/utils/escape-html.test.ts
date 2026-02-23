/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml } from "../../src/utils/escape-html.js";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    assert.equal(escapeHtml("A & B"), "A &amp; B");
  });

  it("escapes less-than signs", () => {
    assert.equal(escapeHtml("<div>"), "&lt;div&gt;");
  });

  it("escapes greater-than signs", () => {
    assert.equal(escapeHtml("a > b"), "a &gt; b");
  });

  it("escapes double quotes", () => {
    assert.equal(escapeHtml('say "hello"'), "say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    assert.equal(escapeHtml("it's"), "it&#39;s");
  });

  it("escapes multiple special characters", () => {
    assert.equal(
      escapeHtml('<script>alert("xss")</script>'),
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
  });

  it("returns the same string if no special characters", () => {
    assert.equal(escapeHtml("Hello world"), "Hello world");
  });

  it("handles empty string", () => {
    assert.equal(escapeHtml(""), "");
  });
});
