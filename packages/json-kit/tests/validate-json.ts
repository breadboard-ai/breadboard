/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual } from "node:assert";
import test, { describe } from "node:test";
import {
  stripCodeBlock,
  tryParseJson,
  validateJson,
} from "../src/nodes/validate-json.js";

describe("validate-json", () => {
  test("tryParseJson correctly parses JSON", (t) => {
    const json = `{"foo": "bar"}`;
    const result = tryParseJson(json);
    deepStrictEqual(result, { foo: "bar" });
  });

  test("tryParseJson correctly returns an error for unparsable JSON", (t) => {
    const json = `{"foo": bar}`;
    const result = tryParseJson(json);
    deepStrictEqual(result, {
      $error: {
        kind: "error",
        error: {
          type: "parsing",
          message: 'Unexpected token \'b\', "{"foo": bar}" is not valid JSON',
        },
      },
    });
  });

  test("validateJson correctly validates JSON", (t) => {
    const parsed = { foo: "bar" };
    const schema = {
      type: "object",
      properties: { foo: { type: "string" } },
    };
    const result = validateJson(parsed, schema);
    deepStrictEqual(result, { json: { foo: "bar" } });
  });

  test("validateJson correctly returns an error for invalid JSON", (t) => {
    const parsed = { foo: "bar" };
    const schema = {
      type: "object",
      properties: { foo: { type: "number" } },
    };
    const result = validateJson(parsed, schema);
    deepStrictEqual(result, {
      $error: {
        kind: "error",
        error: {
          type: "validation",
          message: "data/foo must be number",
        },
      },
    });
  });

  test("stripCodeBlock correctly strips Markdown only if present", (t) => {
    deepStrictEqual(stripCodeBlock('```json\n"json"\n```'), '"json"');
    deepStrictEqual(stripCodeBlock('```\n"json"\n```'), '"json"');
    deepStrictEqual(stripCodeBlock('"json"'), '"json"');
  });

  test("tryParseJson correctly parses JSON with Markdown code block", (t) => {
    const json = '```json\n{"foo": "bar"}\n```';
    const result = tryParseJson(json);
    deepStrictEqual(result, { foo: "bar" });
  });

  test("tryParseJson correctly strips stuff outside of the Markdown code block", (t) => {
    {
      const json = 'bar```json\n{"foo": "bar"}\n```\nfooo';
      const result = tryParseJson(json);
      deepStrictEqual(result, { foo: "bar" });
    }
    {
      const json =
        'sure, here is the JSON you requested:\n\n```json\n{"foo": "bar"}\n```\n\nAdditionally, here is an alternative version of this JSON:\n\n```json\n{"bar": "baz"}\n```\n\nI hope this helps!';
      const result = tryParseJson(json);
      deepStrictEqual(result, { bar: "baz" });
    }
  });
});
