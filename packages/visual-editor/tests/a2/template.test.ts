/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tests for Template.asyncMapParts — the interleaving-by-construction
 * primitive used by resolveToSegments.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { setDOM, unsetDOM } from "../fake-dom.js";
import { Template } from "../../src/a2/a2/template.js";
import type { LLMContent, DataPart } from "@breadboard-ai/types";
import type { ParamPart } from "../../src/a2/a2/template.js";

// Tagged results for easy assertion.
type Tag =
  | { kind: "text"; value: string }
  | { kind: "param"; param: ParamPart }
  | { kind: "data"; part: DataPart };

const handlers = {
  onText: (text: string): Tag => ({ kind: "text", value: text }),
  onParam: async (param: ParamPart): Promise<Tag> => ({
    kind: "param",
    param,
  }),
  onData: (part: DataPart): Tag => ({ kind: "data", part }),
};

describe("Template.asyncMapParts", () => {
  beforeEach(() => setDOM());
  afterEach(() => unsetDOM());

  it("returns empty for empty template", async () => {
    const template = new Template(undefined);
    const result = await template.asyncMapParts<Tag>(handlers);
    assert.deepStrictEqual(result, []);
  });

  it("returns text for text-only template", async () => {
    const content: LLMContent = {
      parts: [{ text: "hello world" }],
      role: "user",
    };
    const template = new Template(content);
    const result = await template.asyncMapParts<Tag>(handlers);
    assert.equal(result.length, 1);
    assert.deepStrictEqual(result[0], { kind: "text", value: "hello world" });
  });

  it("preserves interleaving of text and placeholders", async () => {
    // Template: "describe this {{\"type\":\"in\",\"path\":\"image\",\"title\":\"Image\"}} please"
    const content: LLMContent = {
      parts: [
        {
          text: 'describe this {{"type":"in","path":"image","title":"Image"}} please',
        },
      ],
      role: "user",
    };
    const template = new Template(content);
    const result = await template.asyncMapParts<Tag>(handlers);

    assert.equal(result.length, 3);
    // Text before placeholder
    assert.deepStrictEqual(result[0], {
      kind: "text",
      value: "describe this ",
    });
    // The placeholder itself
    assert.equal(result[1].kind, "param");
    assert.equal(
      (result[1] as { kind: "param"; param: ParamPart }).param.type,
      "in"
    );
    assert.equal(
      (result[1] as { kind: "param"; param: ParamPart }).param.path,
      "image"
    );
    // Text after placeholder
    assert.deepStrictEqual(result[2], { kind: "text", value: " please" });
  });

  it("handles multiple placeholders in order", async () => {
    const content: LLMContent = {
      parts: [
        {
          text: 'A {{"type":"in","path":"x","title":"X"}} B {{"type":"in","path":"y","title":"Y"}} C',
        },
      ],
      role: "user",
    };
    const template = new Template(content);
    const result = await template.asyncMapParts<Tag>(handlers);

    assert.equal(result.length, 5);
    assert.equal(result[0].kind, "text");
    assert.equal((result[0] as { kind: "text"; value: string }).value, "A ");
    assert.equal(result[1].kind, "param");
    assert.equal(
      (result[1] as { kind: "param"; param: ParamPart }).param.path,
      "x"
    );
    assert.equal(result[2].kind, "text");
    assert.equal((result[2] as { kind: "text"; value: string }).value, " B ");
    assert.equal(result[3].kind, "param");
    assert.equal(
      (result[3] as { kind: "param"; param: ParamPart }).param.path,
      "y"
    );
    assert.equal(result[4].kind, "text");
    assert.equal((result[4] as { kind: "text"; value: string }).value, " C");
  });

  it("handles non-text data parts via onData", async () => {
    const inlineData = {
      inlineData: { mimeType: "image/png", data: "abc123" },
    };
    const content: LLMContent = {
      parts: [inlineData as DataPart],
      role: "user",
    };
    const template = new Template(content);
    const result = await template.asyncMapParts<Tag>(handlers);

    assert.equal(result.length, 1);
    assert.equal(result[0].kind, "data");
    assert.deepStrictEqual(
      (result[0] as { kind: "data"; part: DataPart }).part,
      inlineData
    );
  });

  it("supports fan-out (returning arrays from handlers)", async () => {
    const content: LLMContent = {
      parts: [{ text: "hello" }],
      role: "user",
    };
    const template = new Template(content);
    const result = await template.asyncMapParts<string>({
      onText: (text: string) => [text, text.toUpperCase()],
      onParam: async () => "param",
      onData: () => "data",
    });

    assert.deepStrictEqual(result, ["hello", "HELLO"]);
  });

  it("handles tool placeholders in correct position", async () => {
    const content: LLMContent = {
      parts: [
        {
          text: 'use {{"type":"tool","path":"memory","title":"Memory"}} to remember',
        },
      ],
      role: "user",
    };
    const template = new Template(content);
    const result = await template.asyncMapParts<Tag>(handlers);

    assert.equal(result.length, 3);
    assert.equal(result[0].kind, "text");
    assert.equal(result[1].kind, "param");
    assert.equal(
      (result[1] as { kind: "param"; param: ParamPart }).param.type,
      "tool"
    );
    assert.equal(result[2].kind, "text");
  });
});
