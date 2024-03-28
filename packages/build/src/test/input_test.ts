/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { anyOf, array, object } from "../index.js";
import { input } from "../internal/board/input.js";
import type { BreadboardType } from "../internal/type-system/type.js";

/* eslint-disable @typescript-eslint/ban-ts-comment */

function assertType<T extends { type: BreadboardType }>(
  input: T,
  expected: BreadboardType
): T {
  assert.equal(input.type, expected);
  return input;
}

test("defaults to string", () => {
  // $ExpectType Input<string>
  assertType(input(), "string");
});

test("only type", () => {
  // $ExpectType Input<string>
  assertType(input({ type: "string" }), "string");

  // $ExpectType Input<number>
  assertType(input({ type: "number" }), "number");

  // $ExpectType Input<boolean>
  assertType(input({ type: "boolean" }), "boolean");

  // $ExpectType Input<string | number>
  input({ type: anyOf("string", "number") });

  // $ExpectType Input<{ foo: string; }>
  input({ type: object({ foo: "string" }) });
});

test("only default", () => {
  // $ExpectType InputWithDefault<string>
  assertType(input({ default: "foo" }), "string");

  // $ExpectType InputWithDefault<number>
  assertType(input({ default: 42 }), "number");

  // $ExpectType InputWithDefault<boolean>
  assertType(input({ default: true }), "boolean");
});

test("type and default", () => {
  // $ExpectType InputWithDefault<string>
  assertType(input({ type: "string", default: "foo" }), "string");

  // $ExpectType InputWithDefault<number>
  assertType(input({ type: "number", default: 42 }), "number");

  // $ExpectType InputWithDefault<boolean>
  assertType(input({ type: "boolean", default: true }), "boolean");

  // $ExpectType InputWithDefault<{ foo: string[]; }>
  input({
    type: object({ foo: array("string") }),
    default: { foo: ["bar"] },
  });
});

test("default doesn't match type", () => {
  // @ts-expect-error
  input({ type: "string", default: 42 });

  // @ts-expect-error
  input({ type: "number", default: true });

  // @ts-expect-error
  input({ type: "boolean", default: "foo" });

  input({
    type: object({ foo: array("string") }),
    // @ts-expect-error
    default: {
      foo: [42],
    },
  });
});

test("invalid types", () => {
  // @ts-expect-error
  input({ type: undefined });

  // @ts-expect-error
  input({ type: null });

  // @ts-expect-error
  input({ type: "foo" });
});

test("invalid defaults", () => {
  // @ts-expect-error
  input({ default: undefined });

  // @ts-expect-error
  assert.throws(() => input({ default: null }), /Unknown default type: null/);

  assert.throws(
    // @ts-expect-error
    () => input({ default: { foo: "bar" } }),
    /Error: Unknown default type: {"foo":"bar"}/
  );
});
