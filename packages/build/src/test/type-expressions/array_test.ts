/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { anyOf, array, object } from "@breadboard-ai/build";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  toJSONSchema,
  type ConvertBreadboardType,
} from "../../internal/type-system/type.js";

/* eslint-disable @typescript-eslint/no-unused-vars */

test("no arguments", () => {
  // @ts-expect-error no arguments
  assert.throws(() => array());
});

test("array of numbers", () => {
  const arr = array("number");
  // $ExpectType number[]
  type arrayType = ConvertBreadboardType<typeof arr>;
  assert.deepEqual(toJSONSchema(arr), {
    type: "array",
    items: { type: "number" },
  });
});

test("array of objects", () => {
  const arr = array(object({ foo: "string" }));
  // $ExpectType { foo: string; }[]
  type arrayType = ConvertBreadboardType<typeof arr>;
  assert.deepEqual(toJSONSchema(arr), {
    type: "array",
    items: {
      type: "object",
      properties: { foo: { type: "string" } },
      required: ["foo"],
      additionalProperties: false,
    },
  });
});

test("array of anyOf types", () => {
  const arr = array(anyOf("string", "number"));
  // $ExpectType (string | number)[]
  type arrayType = ConvertBreadboardType<typeof arr>;
  assert.deepEqual(toJSONSchema(arr), {
    type: "array",
    items: { type: ["string", "number"] },
  });
});

test("array of unknown", () => {
  const arr = array("unknown");
  // $ExpectType JsonSerializable[]
  type arrayType = ConvertBreadboardType<typeof arr>;
  assert.deepEqual(toJSONSchema(arr), {
    items: {
      type: ["array", "boolean", "null", "number", "object", "string"],
    },
    type: "array",
  });
});
