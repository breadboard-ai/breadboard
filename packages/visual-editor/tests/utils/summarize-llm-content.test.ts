/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeLLMContentValue } from "../../src/utils/summarize-llm-content.js";

describe("summarizeLLMContentValue", () => {
  it("returns null for non-object values", () => {
    assert.equal(summarizeLLMContentValue("hello"), null);
    assert.equal(summarizeLLMContentValue(42), null);
    assert.equal(summarizeLLMContentValue(null), null);
    assert.equal(summarizeLLMContentValue(undefined), null);
    assert.equal(summarizeLLMContentValue(true), null);
  });

  it("returns null for non-LLMContent objects", () => {
    assert.equal(summarizeLLMContentValue({ foo: "bar" }), null);
    assert.equal(summarizeLLMContentValue([1, 2, 3]), null);
  });

  it("returns text for a single LLMContent with text part", () => {
    const value = { parts: [{ text: "Hello world" }], role: "user" };
    assert.equal(summarizeLLMContentValue(value), "Hello world");
  });

  it("returns text for an LLMContent array with text part", () => {
    const value = [{ parts: [{ text: "Hello world" }], role: "user" }];
    assert.equal(summarizeLLMContentValue(value), "Hello world");
  });

  it("returns default empty label for empty text", () => {
    const value = { parts: [{ text: "" }], role: "user" };
    assert.equal(summarizeLLMContentValue(value), "(empty text)");
  });

  it("allows custom empty text label", () => {
    const value = { parts: [{ text: "" }], role: "user" };
    assert.equal(summarizeLLMContentValue(value, "(Empty)"), "(Empty)");
  });

  it("returns mimeType for inline data part", () => {
    const value = {
      parts: [{ inlineData: { mimeType: "image/png", data: "abc123" } }],
      role: "user",
    };
    assert.equal(summarizeLLMContentValue(value), "image/png");
  });

  it("returns mimeType for stored data part", () => {
    const value = {
      parts: [
        { storedData: { mimeType: "application/pdf", handle: "blob:foo" } },
      ],
      role: "user",
    };
    assert.equal(summarizeLLMContentValue(value), "application/pdf");
  });

  it('returns "LLM Content Part" for unknown part types', () => {
    const value = {
      parts: [{ functionCall: { name: "test", args: {} } }],
      role: "user",
    };
    assert.equal(summarizeLLMContentValue(value), "LLM Content Part");
  });

  it('returns "0 items" for an empty LLMContent array', () => {
    assert.equal(summarizeLLMContentValue([]), "0 items");
  });

  it("uses the first entry in a multi-item LLMContent array", () => {
    const value = [
      { parts: [{ text: "First" }], role: "user" },
      { parts: [{ text: "Second" }], role: "model" },
    ];
    assert.equal(summarizeLLMContentValue(value), "First");
  });
});
