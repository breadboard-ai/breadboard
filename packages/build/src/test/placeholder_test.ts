/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { anyOf, defineNodeType, input, object } from "../index.js";
import { placeholder } from "../internal/board/placeholder.js";
import type { BreadboardType } from "../internal/type-system/type.js";

/* eslint-disable @typescript-eslint/ban-ts-comment */

function assertType<T extends { type: BreadboardType }>(
  placeholder: T,
  expected: BreadboardType
): T {
  assert.equal(placeholder.type, expected);
  return placeholder;
}

test("defaults to string", () => {
  // $ExpectType Placeholder<string>
  assertType(placeholder(), "string");
});

test("only type", () => {
  // $ExpectType Placeholder<string>
  assertType(placeholder({ type: "string" }), "string");

  // $ExpectType Placeholder<number>
  assertType(placeholder({ type: "number" }), "number");

  // $ExpectType Placeholder<boolean>
  assertType(placeholder({ type: "boolean" }), "boolean");

  // $ExpectType Placeholder<string | number>
  placeholder({ type: anyOf("string", "number") });

  // $ExpectType Placeholder<{ foo: string; }>
  placeholder({ type: object({ foo: "string" }) });
});

test("invalid types", () => {
  // @ts-expect-error
  placeholder({ type: undefined });

  // @ts-expect-error
  placeholder({ type: null });

  // @ts-expect-error
  placeholder({ type: "foo" });
});

test("error: missing resolve value", () => {
  // @ts-expect-error
  placeholder().resolve();

  // @ts-expect-error
  placeholder().resolve(undefined);

  // @ts-expect-error
  placeholder().resolve(null);
});

test("error: resolve with raw value", () => {
  // @ts-expect-error
  placeholder().resolve("foo");
});

test("error: resolve with input", () => {
  // @ts-expect-error
  placeholder().resolve(input());
});

test("error: resolve with another placeholder", () => {
  // @ts-expect-error
  placeholder().resolve(placeholder());
});

test("error: resolve multiple times", () => {
  const node = defineNodeType({
    name: "node",
    inputs: {},
    outputs: { a: { type: "string" } },
    invoke: () => ({ a: "a" }),
  })({});
  const p = placeholder();
  p.resolve(node.outputs.a);
  assert.throws(
    () => p.resolve(node.outputs.a),
    /Placeholder has already been resolved/
  );
});
