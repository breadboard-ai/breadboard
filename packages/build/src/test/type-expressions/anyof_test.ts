/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { anyOf, object } from "@breadboard-ai/build";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  toJSONSchema,
  type BreadboardType,
  type ConvertBreadboardType,
} from "../../internal/type-system/type.js";

/* eslint-disable @typescript-eslint/no-unused-vars */

test("anyOf", () => {
  // @ts-expect-error no arguments
  anyOf();
  // @ts-expect-error only one argument
  anyOf("number");
  // @ts-expect-error not a valid type
  assert.throws(() => anyOf(undefined));
  // @ts-expect-error not a valid type
  assert.throws(() => anyOf("xnumber", "xstring"));

  const with2 = anyOf("number", "boolean") satisfies BreadboardType;
  // $ExpectType number | boolean
  type t2 = ConvertBreadboardType<typeof with2>;
  assert.deepEqual(toJSONSchema(with2), {
    type: ["number", "boolean"],
  });

  const with3 = anyOf("number", "boolean", "string") satisfies BreadboardType;
  // $ExpectType string | number | boolean
  type t3 = ConvertBreadboardType<typeof with3>;
  assert.deepEqual(toJSONSchema(with3), {
    type: ["number", "boolean", "string"],
  });
});

test("hoists common type", () => {
  const any = anyOf(object({}), object({}));
  assert.deepEqual(toJSONSchema(any), {
    type: "object",
    anyOf: [
      {
        additionalProperties: false,
        properties: {},
        required: [],
        type: "object",
      },
      {
        additionalProperties: false,
        properties: {},
        required: [],
        type: "object",
      },
    ],
  });
});
