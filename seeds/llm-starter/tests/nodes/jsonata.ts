/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { jsonataDescriber } from "../../src/nodes/jsonata.js";

test("`jsonataDescriber` correctly reacts to `raw = false`", async (t) => {
  const result = await jsonataDescriber();
  t.like(result, {
    inputSchema: {
      type: "object",
      properties: { expression: { title: "expression" } },
      required: ["expression"],
    },
    outputSchema: {
      type: "object",
      properties: { result: { title: "result" } },
      required: ["result"],
    },
  });
});

test("`jsonataDescriber` correctly reacts to `raw = true`", async (t) => {
  const result = await jsonataDescriber({
    expression: "foo",
    json: { foo: { bar: "baz" } },
    raw: true,
  });
  t.like(result, {
    inputSchema: {
      type: "object",
      properties: {
        expression: { title: "expression" },
        json: { title: "json" },
        raw: { title: "raw" },
      },
      required: ["expression"],
    },
    outputSchema: {
      type: "object",
      properties: { bar: { title: "bar" } },
    },
  });
});

test("`jsonataDescriber` correctly reacts to invalid input", async (t) => {
  const result = await jsonataDescriber({
    raw: true,
  });
  t.like(result, {
    inputSchema: {
      type: "object",
      properties: {
        expression: { title: "expression" },
        json: { title: "json" },
        raw: { title: "raw" },
      },
      required: ["expression"],
    },
    outputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  });
});
