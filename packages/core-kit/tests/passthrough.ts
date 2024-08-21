/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import passthrough from "../src/nodes/passthrough.js";

test("pass through all values", async (t) => {
  const inputs = {
    str: "foo",
    num: 123,
    arr: [{ bool: true }],
  };
  const actual = await passthrough.invoke(inputs, null as never);
  const expected = inputs;
  t.deepEqual(actual, expected);
});

test("describe with no parameters returns empty schemas", async (t) => {
  const actual = await passthrough.describe();
  const expected = {
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: true,
    },
    outputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  };
  t.deepEqual(actual, expected);
});

test("describe uses input values to generate output schema", async (t) => {
  const actual = await passthrough.describe(
    {
      str: "foo",
      num: 123,
      arr: [true],
    },
    {
      type: "object",
      properties: {
        str: { type: "string" },
        num: { type: "number" },
        arr: { type: "array", items: { type: "boolean" } },
      },
    },
    {
      type: "object",
      properties: {
        ignored: {
          type: "string",
        },
      },
    }
  );
  const expected = {
    inputSchema: {
      type: "object",
      properties: {
        str: {
          title: "str",
          type: "string",
        },
        num: {
          title: "num",
          type: "number",
        },
        arr: {
          title: "arr",
          type: "array",
          items: {
            type: "boolean",
          },
        },
      },
      required: [],
      additionalProperties: true,
    },
    outputSchema: {
      type: "object",
      properties: {
        str: {
          title: "str",
          type: "string",
        },
        num: {
          title: "num",
          type: "number",
        },
        arr: {
          title: "arr",
          type: "array",
          items: {
            type: "boolean",
          },
        },
      },
      required: [],
      additionalProperties: false,
    },
  };
  t.deepEqual(actual, expected);
});
