/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { enumeration, array } from "@breadboard-ai/build";
import assert from "node:assert/strict";
import { test } from "node:test";
import { toJSONSchema } from "../internal/type-system/type.js";

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-ts-comment */

test("1 string", () => {
  assert.deepEqual(
    toJSONSchema(
      // $ExpectType AdvancedBreadboardType<"foo">
      enumeration("foo")
    ),
    { enum: ["foo"] }
  );
});

test("3 strings", () => {
  assert.deepEqual(
    toJSONSchema(
      // $ExpectType AdvancedBreadboardType<"foo" | "bar" | "baz">
      enumeration("foo", "bar", "baz")
    ),
    { enum: ["foo", "bar", "baz"] }
  );
});

test("2 numbers", () => {
  assert.deepEqual(
    toJSONSchema(
      // $ExpectType AdvancedBreadboardType<123 | 456>
      enumeration(123, 456)
    ),
    { enum: [123, 456] }
  );
});

test("boolean", () => {
  assert.deepEqual(
    toJSONSchema(
      // $ExpectType AdvancedBreadboardType<true>
      enumeration(true)
    ),
    { enum: [true] }
  );
});

test("null", () => {
  assert.deepEqual(
    toJSONSchema(
      // $ExpectType AdvancedBreadboardType<null>
      enumeration(null)
    ),
    { enum: [null] }
  );
});

test("multiple types", () => {
  assert.deepEqual(
    toJSONSchema(
      // $ExpectType AdvancedBreadboardType<true | "foo">
      enumeration("foo", true)
    ),
    { enum: ["foo", true] }
  );
});

test("error: no values", () => {
  // @ts-expect-error
  assert.throws(() => enumeration(), /enumeration needs at least one value/);
});

test("error: undefined", () => {
  assert.throws(
    () =>
      // @ts-expect-error
      enumeration(undefined),
    /enumeration values must be string, number, boolean, or null. Got undefined./
  );
});

test("error: object", () => {
  assert.throws(
    () =>
      // @ts-expect-error
      enumeration({}),
    /enumeration values must be string, number, boolean, or null. Got object./
  );
});

test("error: unknown", () => {
  // @ts-expect-error
  enumeration(null as unknown);
});

test("error: other advanced type", () => {
  assert.throws(
    () =>
      // @ts-expect-error
      enumeration(array("string")),
    /enumeration values must be string, number, boolean, or null. Got object./
  );
});
