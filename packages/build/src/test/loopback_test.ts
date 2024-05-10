/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { anyOf, defineNodeType, input, object } from "../index.js";
import { loopback } from "../internal/board/loopback.js";
import type { BreadboardType } from "../internal/type-system/type.js";

/* eslint-disable @typescript-eslint/ban-ts-comment */

function assertType<T extends { type: BreadboardType }>(
  loopback: T,
  expected: BreadboardType
): T {
  assert.equal(loopback.type, expected);
  return loopback;
}

test("defaults to string", () => {
  // $ExpectType Loopback<string>
  assertType(loopback(), "string");
});

test("only type", () => {
  // $ExpectType Loopback<string>
  assertType(loopback({ type: "string" }), "string");

  // $ExpectType Loopback<number>
  assertType(loopback({ type: "number" }), "number");

  // $ExpectType Loopback<boolean>
  assertType(loopback({ type: "boolean" }), "boolean");

  // $ExpectType Loopback<string | number>
  loopback({ type: anyOf("string", "number") });

  // $ExpectType Loopback<{ foo: string; }>
  loopback({ type: object({ foo: "string" }) });
});

test("invalid types", () => {
  // @ts-expect-error
  loopback({ type: undefined });

  // @ts-expect-error
  loopback({ type: null });

  // @ts-expect-error
  loopback({ type: "foo" });
});

test("error: missing resolve value", () => {
  // @ts-expect-error
  loopback().resolve();

  // @ts-expect-error
  loopback().resolve(undefined);

  // @ts-expect-error
  loopback().resolve(null);
});

test("error: resolve with raw value", () => {
  // @ts-expect-error
  loopback().resolve("foo");
});

test("error: resolve with input", () => {
  // @ts-expect-error
  loopback().resolve(input());
});

test("error: resolve with another loopback", () => {
  // @ts-expect-error
  loopback().resolve(loopback());
});

test("error: resolve with wrong type", () => {
  const node = defineNodeType({
    name: "node",
    inputs: {},
    outputs: { a: { type: "string" } },
    invoke: () => ({ a: "a" }),
  })({});
  const p = loopback({ type: "number" });
  // @ts-expect-error
  p.resolve(node.outputs.a);
});

test("error: resolve multiple times", () => {
  const node = defineNodeType({
    name: "node",
    inputs: {},
    outputs: { a: { type: "string" } },
    invoke: () => ({ a: "a" }),
  })({});
  const p = loopback();
  p.resolve(node.outputs.a);
  assert.throws(
    () => p.resolve(node.outputs.a),
    /Loopback has already been resolved/
  );
});
