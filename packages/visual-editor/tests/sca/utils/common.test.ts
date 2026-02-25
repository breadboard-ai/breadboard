/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  idFromIndex,
  toLLMContentArray,
  getFirstFileDataPart,
  toJson,
} from "../../../src/sca/utils/common.js";
import type { Schema, OutputValues } from "@breadboard-ai/types";

suite("idFromIndex", () => {
  test("creates id from index", () => {
    assert.strictEqual(idFromIndex("abc"), "e-abc");
  });

  test("creates id from UUID-like index", () => {
    assert.strictEqual(idFromIndex("550e-8400"), "e-550e-8400");
  });
});

suite("toLLMContentArray", () => {
  test("stringifies values as JSON parts when schema has no properties", () => {
    const schema: Schema = {};
    const values: OutputValues = { text: "hello" };
    const result = toLLMContentArray(schema, values);
    assert.deepStrictEqual(result.products.text, {
      parts: [{ json: "hello" }],
    });
  });

  test("handles string type properties", () => {
    const schema: Schema = {
      properties: { name: { type: "string" } },
    };
    const values: OutputValues = { name: "Alice" };
    const result = toLLMContentArray(schema, values);
    assert.deepStrictEqual(result.products.name, {
      parts: [{ text: "Alice" }],
    });
  });

  test("handles number type properties", () => {
    const schema: Schema = {
      properties: { count: { type: "number" } },
    };
    const values: OutputValues = { count: 42 };
    const result = toLLMContentArray(schema, values);
    assert.deepStrictEqual(result.products.count, {
      parts: [{ text: "42" }],
    });
  });

  test("handles boolean type properties", () => {
    const schema: Schema = {
      properties: { active: { type: "boolean" } },
    };
    const values: OutputValues = { active: true };
    const result = toLLMContentArray(schema, values);
    assert.deepStrictEqual(result.products.active, {
      parts: [{ text: "true" }],
    });
  });

  test("handles LLMContent object properties", () => {
    const schema: Schema = {
      properties: {
        content: { type: "object", behavior: ["llm-content"] },
      },
    };
    const llmContent = { parts: [{ text: "hello" }], role: "user" as const };
    const values: OutputValues = { content: llmContent };
    const result = toLLMContentArray(schema, values);
    assert.deepStrictEqual(result.products.content, llmContent);
  });

  test("handles LLMContent array properties, takes first item", () => {
    const schema: Schema = {
      properties: {
        items: {
          type: "array",
          items: { behavior: ["llm-content"] },
        },
      },
    };
    const first = { parts: [{ text: "first" }] };
    const second = { parts: [{ text: "second" }] };
    const values: OutputValues = { items: [first, second] };
    const result = toLLMContentArray(schema, values);
    assert.deepStrictEqual(result.products.items, first);
  });

  test("skips missing values", () => {
    const schema: Schema = {
      properties: { missing: { type: "string" } },
    };
    const values: OutputValues = {};
    const result = toLLMContentArray(schema, values);
    assert.strictEqual(result.products.missing, undefined);
  });

  test("falls back to JSON for unknown types", () => {
    const schema: Schema = {
      properties: { obj: { type: "object" } },
    };
    const values: OutputValues = { obj: { key: "val" } };
    const result = toLLMContentArray(schema, values);
    assert.deepStrictEqual(result.products.obj, {
      parts: [{ json: { key: "val" } }],
    });
  });
});

suite("getFirstFileDataPart", () => {
  test("returns fileData part when first part is fileData", () => {
    const content = {
      parts: [{ fileData: { mimeType: "image/png", fileUri: "gs://foo" } }],
    };
    const result = getFirstFileDataPart(content);
    assert.deepStrictEqual(result, content.parts[0]);
  });

  test("returns null when first part is not fileData", () => {
    const content = { parts: [{ text: "hello" }] };
    const result = getFirstFileDataPart(content);
    assert.strictEqual(result, null);
  });

  test("returns null when parts is empty", () => {
    const content = { parts: [] };
    const result = getFirstFileDataPart(content);
    assert.strictEqual(result, null);
  });

  test("returns null when content throws (catch path)", () => {
    // Pass something that is not LLMContent so accessing .parts throws
    const result = getFirstFileDataPart(null as never);
    assert.strictEqual(result, null);
  });
});

suite("toJson", () => {
  test("extracts json from first content part", () => {
    const content = [{ parts: [{ json: { key: "value" } }] }];
    const result = toJson(content);
    assert.deepStrictEqual(result, { key: "value" });
  });

  test("returns undefined for undefined input", () => {
    assert.strictEqual(toJson(undefined), undefined);
  });

  test("returns undefined for empty array", () => {
    assert.strictEqual(toJson([]), undefined);
  });

  test("returns undefined when part has no json", () => {
    const content = [{ parts: [{ text: "hello" }] }];
    const result = toJson(content as never);
    assert.strictEqual(result, undefined);
  });
});
