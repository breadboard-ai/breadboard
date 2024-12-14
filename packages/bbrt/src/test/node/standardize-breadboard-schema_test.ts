/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Schema } from "@google-labs/breadboard";
import type { JSONSchema7 } from "json-schema";
import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { standardizeBreadboardSchema } from "../../breadboard/standardize-breadboard-schema.js";

suite("standardizeBreadboardSchema", () => {
  test("removes behaviors recursively", () => {
    const input: Schema = {
      type: "object",
      behavior: ["config"],
      properties: {
        foo: {
          type: "string",
          behavior: ["code", "deprecated"],
        },
        bar: {
          type: "array",
          items: {
            type: "number",
            behavior: ["bubble"],
          },
        },
      },
    };
    const expected: JSONSchema7 = {
      type: "object",
      properties: {
        foo: {
          type: "string",
        },
        bar: {
          type: "array",
          items: {
            type: "number",
          },
        },
      },
    };
    assert.deepEqual(standardizeBreadboardSchema(input), expected);
  });

  test("decodes JSON-encoded defaults", () => {
    const input: Schema = {
      type: "object",
      default: '{"foo":42}',
      properties: {
        foo: {
          type: "number",
          default: "42",
        },
        bar: {
          type: "boolean",
          default: "true",
        },
        baz: {
          type: "number",
          default: 47 as unknown as string,
        },
      },
    };
    const expected: JSONSchema7 = {
      type: "object",
      default: { foo: 42 },
      properties: {
        foo: {
          type: "number",
          default: 42,
        },
        bar: {
          type: "boolean",
          default: true,
        },
        baz: {
          type: "number",
          default: 47,
        },
      },
    };
    assert.deepEqual(standardizeBreadboardSchema(input), expected);
  });

  test("decodes JSON-encoded examples", () => {
    const input: Schema = {
      type: "object",
      examples: ['{"foo":42}'],
      properties: {
        foo: {
          type: "number",
          examples: ["42"],
        },
        bar: {
          type: "boolean",
          examples: ["true", "false"],
        },
        baz: {
          type: "number",
          examples: [47 as unknown as string],
        },
      },
    };
    const expected: JSONSchema7 = {
      type: "object",
      examples: [{ foo: 42 }],
      properties: {
        foo: {
          type: "number",
          examples: [42],
        },
        bar: {
          type: "boolean",
          examples: [true, false],
        },
        baz: {
          type: "number",
          examples: [47],
        },
      },
    };
    assert.deepEqual(standardizeBreadboardSchema(input), expected);
  });

  test("expands llm-content object behavior to JSON schema", () => {
    const input: Schema = {
      type: "object",
      properties: {
        foo: {
          type: "object",
          behavior: ["llm-content"],
        },
      },
    };
    const expected: JSONSchema7 = {
      type: "object",
      properties: {
        foo: {
          type: "object",
          required: ["role", "parts"],
          properties: {
            role: {
              type: "string",
              enum: ["user", "model"],
            },
            parts: {
              type: "array",
              items: {
                type: "object",
                required: ["text"],
                properties: {
                  text: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
      },
    };
    assert.deepEqual(standardizeBreadboardSchema(input), expected);
  });

  test("expands llm-content array behavior to JSON schema", () => {
    const input: Schema = {
      type: "object",
      properties: {
        foo: {
          type: "array",
          items: {
            type: "object",
            behavior: ["llm-content"],
          },
        },
      },
    };
    const expected: JSONSchema7 = {
      type: "object",
      properties: {
        foo: {
          type: "array",
          items: {
            type: "object",
            required: ["role", "parts"],
            properties: {
              role: {
                type: "string",
                enum: ["user", "model"],
              },
              parts: {
                type: "array",
                items: {
                  type: "object",
                  required: ["text"],
                  properties: {
                    text: {
                      type: "string",
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    assert.deepEqual(standardizeBreadboardSchema(input), expected);
  });
});
