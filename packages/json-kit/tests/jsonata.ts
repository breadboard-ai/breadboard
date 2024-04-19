/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepEqual } from "node:assert";
import test, { describe } from "node:test";
import { jsonataDescriber } from "../src/nodes/jsonata.js";
describe("jsonata", () => {
  test("`jsonataDescriber` correctly reacts to `raw = false`", async () => {
    const result = await jsonataDescriber();
    const expected = {
      inputSchema: {
        type: "object",
        properties: {
          expression: {
            title: "expression",
            behavior: ["config"],
            description: "The Jsonata expression to evaluate",
            type: "string",
          },
          raw: {
            title: "raw",
            behavior: ["config"],
            description:
              "Whether or not to return use the evaluation result as raw output (true) or as a port called `result` (false). Default is false.",
            type: "boolean",
          },
          json: {
            title: "json",
            description: "The JSON object to evaluate",
            type: ["object", "string"],
          },
        },
        additionalProperties: false,
        required: ["expression"],
      },
      outputSchema: {
        type: "object",
        properties: {
          result: {
            title: "result",
            description: "The result of the Jsonata expression",
            type: "string",
          },
        },
        required: ["result"],
      },
    };
    deepEqual(result, expected);
  });

  test("`jsonataDescriber` correctly reacts to `raw = true`", async () => {
    const result = await jsonataDescriber({
      expression: "foo",
      json: { foo: { bar: "baz" } },
      raw: true,
    });
    const expected = {
      inputSchema: {
        type: "object",
        properties: {
          expression: {
            title: "expression",
            behavior: ["config"],
            description: "The Jsonata expression to evaluate",
            type: "string",
          },
          raw: {
            title: "raw",
            behavior: ["config"],
            description:
              "Whether or not to return use the evaluation result as raw output (true) or as a port called `result` (false). Default is false.",
            type: "boolean",
          },
          json: {
            title: "json",
            description: "The JSON object to evaluate",
            type: ["object", "string"],
          },
        },
        additionalProperties: false,
        required: ["expression"],
      },
      outputSchema: {
        type: "object",
        properties: {
          bar: {
            type: "string",
            title: "bar",
          },
        },
      },
    };
    deepEqual(result, expected);
  });

  test("`jsonataDescriber` correctly reacts to invalid input", async () => {
    const result = await jsonataDescriber({
      raw: true,
    });
    const expected = {
      inputSchema: {
        type: "object",
        properties: {
          expression: {
            title: "expression",
            behavior: ["config"],
            description: "The Jsonata expression to evaluate",
            type: "string",
          },
          raw: {
            title: "raw",
            behavior: ["config"],
            description:
              "Whether or not to return use the evaluation result as raw output (true) or as a port called `result` (false). Default is false.",
            type: "boolean",
          },
          json: {
            title: "json",
            description: "The JSON object to evaluate",
            type: ["object", "string"],
          },
        },
        additionalProperties: false,
        required: ["expression"],
      },
      outputSchema: {
        type: "object",
        properties: {},
      },
    };
    deepEqual(result, expected);
  });
});
