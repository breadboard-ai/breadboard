/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import jsonata from "../src/nodes/jsonata.js";

describe("jsonata", () => {
  test("`jsonata.describe` correctly reacts to `raw = <default=false>`", async () => {
    const result = await jsonata.describe();
    const expected = {
      inputSchema: {
        type: "object",
        properties: {
          expression: {
            title: "Expression",
            behavior: ["config"],
            description: "The Jsonata expression to evaluate",
            type: "string",
          },
          raw: {
            title: "Raw",
            behavior: ["config"],
            description:
              "Whether or not to return use the evaluation result as raw output (true) or as a port called `result` (false). Default is false.",
            type: "boolean",
            default: false,
          },
          json: {
            title: "JSON",
            description:
              "The JSON object to evaluate. If not set, dynamically wired input ports act as the properties of a JSON object.",
            type: ["array", "boolean", "null", "number", "object", "string"],
          },
        },
        additionalProperties: true,
        required: ["expression"],
      },
      outputSchema: {
        type: "object",
        properties: {
          result: {
            title: "Result",
            description: "The result of the Jsonata expression",
            type: ["array", "boolean", "null", "number", "object", "string"],
          },
        },
        required: [],
        additionalProperties: false,
      },
    };
    assert.deepEqual(result, expected);
  });

  test("`jsonata.describe` correctly reacts to `raw = true`", async () => {
    const result = await jsonata.describe({
      expression: "foo",
      json: { foo: { bar: "baz" } },
      raw: true,
    });
    const expected = {
      inputSchema: {
        type: "object",
        properties: {
          expression: {
            title: "Expression",
            behavior: ["config"],
            description: "The Jsonata expression to evaluate",
            type: "string",
          },
          raw: {
            title: "Raw",
            behavior: ["config"],
            description:
              "Whether or not to return use the evaluation result as raw output (true) or as a port called `result` (false). Default is false.",
            type: "boolean",
            default: false,
          },
          json: {
            title: "JSON",
            description:
              "The JSON object to evaluate. If not set, dynamically wired input ports act as the properties of a JSON object.",
            type: ["array", "boolean", "null", "number", "object", "string"],
          },
        },
        additionalProperties: false,
        required: ["expression"],
      },
      outputSchema: {
        type: "object",
        properties: {
          bar: {
            type: ["array", "boolean", "null", "number", "object", "string"],
            title: "bar",
          },
        },
        required: [],
        additionalProperties: true,
      },
    };
    assert.deepEqual(result, expected);
  });

  test("`jsonata.describe` correctly reacts to invalid input", async () => {
    const result = await jsonata.describe({
      raw: true,
    });
    const expected = {
      inputSchema: {
        type: "object",
        properties: {
          expression: {
            title: "Expression",
            behavior: ["config"],
            description: "The Jsonata expression to evaluate",
            type: "string",
          },
          raw: {
            title: "Raw",
            behavior: ["config"],
            description:
              "Whether or not to return use the evaluation result as raw output (true) or as a port called `result` (false). Default is false.",
            type: "boolean",
            default: false,
          },
          json: {
            title: "JSON",
            description:
              "The JSON object to evaluate. If not set, dynamically wired input ports act as the properties of a JSON object.",
            type: ["array", "boolean", "null", "number", "object", "string"],
          },
        },
        additionalProperties: true,
        required: ["expression"],
      },
      outputSchema: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: true,
      },
    };
    assert.deepEqual(result, expected);
  });

  test("invoke in raw mode", async () => {
    const actual = await jsonata.invoke(
      {
        raw: true,
        expression: "foo",
        json: { foo: { bar: "baz" } },
      },
      null as never
    );
    const expected = {
      bar: "baz",
    };
    assert.deepEqual(actual, expected);
  });

  test("invoke in not raw mode", async () => {
    const actual = await jsonata.invoke(
      {
        expression: "foo",
        json: { foo: { bar: "baz" } },
      },
      null as never
    );
    const expected = {
      result: {
        bar: "baz",
      },
    };
    assert.deepEqual(actual, expected);
  });

  test("invoke in not raw mode and doesn't return object", async () => {
    assert.deepEqual(
      await jsonata.invoke(
        {
          expression: "foo.bar",
          json: { foo: { bar: "baz" } },
        },
        null as never
      ),
      { result: "baz" }
    );
  });

  test("invoke in raw mode and doesn't return object", async () => {
    assert.deepEqual(
      await jsonata.invoke(
        {
          raw: true,
          expression: "foo.bar",
          json: { foo: { bar: "baz" } },
        },
        null as never
      ),
      {
        $error: {
          kind: "error",
          error: {
            message:
              "jsonata node in raw mode but expression did not return an object",
          },
        },
      }
    );
  });
});
