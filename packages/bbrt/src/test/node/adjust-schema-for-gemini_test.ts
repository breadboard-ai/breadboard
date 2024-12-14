/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema7 } from "json-schema";
import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { adjustSchemaForGemini } from "../../drivers/adjust-schema-for-gemini.js";

suite("adjustSchemaForGemini", () => {
  test("removes title, default, examples", () => {
    const input: JSONSchema7 = {
      type: "object",
      properties: {
        foo: {
          type: "string",
          title: "Foo Title",
          description: "Foo Description",
          default: "foo",
          examples: ["foo", "bar"],
        },
      },
    };
    const expected: JSONSchema7 = {
      type: "object",
      properties: {
        foo: {
          type: "string",
          description: "Foo Description",
        },
      },
    };
    assert.deepEqual(adjustSchemaForGemini(input), expected);
  });

  test("removes additionalProperties", () => {
    const input: JSONSchema7 = {
      type: "object",
      additionalProperties: true,
      properties: {
        foo: {
          type: "string",
        },
      },
    };
    const expected: JSONSchema7 = {
      type: "object",
      properties: {
        foo: {
          type: "string",
        },
      },
    };
    assert.deepEqual(adjustSchemaForGemini(input), expected);
  });

  test("removes empty objects", () => {
    const input: JSONSchema7 = {
      type: "object",
      properties: {
        foo: {
          type: "object",
        },
        bar: {
          type: "object",
          properties: {},
        },
        baz: {
          type: "string",
        },
      },
    };
    const expected: JSONSchema7 | undefined = {
      type: "object",
      properties: {
        baz: {
          type: "string",
        },
      },
    };
    assert.deepEqual(adjustSchemaForGemini(input), expected);
  });

  test("removes empty objects, cascading to top", () => {
    const input: JSONSchema7 = {
      type: "object",
      properties: {
        foo: {
          type: "object",
        },
      },
    };
    const expected: JSONSchema7 | undefined = undefined;
    assert.deepEqual(adjustSchemaForGemini(input), expected);
  });
});
