/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { anyOf, array, object } from "../index.js";
import { input, type GenericSpecialInput } from "../internal/board/input.js";
import type {
  BreadboardType,
  JsonSerializable,
} from "../internal/type-system/type.js";

/* eslint-disable @typescript-eslint/ban-ts-comment */

function checkInput<T extends GenericSpecialInput>(
  input: T,
  expectedType: BreadboardType,
  expectedExamples?: JsonSerializable[]
): T {
  assert.equal(input.type, expectedType);
  assert.deepEqual(input.examples, expectedExamples);
  return input;
}

test("defaults to string", () => {
  // $ExpectType Input<string>
  checkInput(input(), "string");

  checkInput(
    // $ExpectType Input<string>
    input({ description: "Hello" }),
    "string"
  );
});

test("only type", () => {
  // $ExpectType Input<string>
  checkInput(input({ type: "string" }), "string");

  // $ExpectType Input<number>
  checkInput(input({ type: "number" }), "number");

  // $ExpectType Input<boolean>
  checkInput(input({ type: "boolean" }), "boolean");

  // $ExpectType Input<string | number>
  input({ type: anyOf("string", "number") });

  // $ExpectType Input<{ foo: string; }>
  input({ type: object({ foo: "string" }) });
});

test("only default", () => {
  // $ExpectType InputWithDefault<string>
  checkInput(input({ default: "foo" }), "string");

  // $ExpectType InputWithDefault<number>
  checkInput(input({ default: 42 }), "number");

  // $ExpectType InputWithDefault<boolean>
  checkInput(input({ default: true }), "boolean");
});

test("type and default", () => {
  // $ExpectType InputWithDefault<string>
  checkInput(input({ type: "string", default: "foo" }), "string");

  // $ExpectType InputWithDefault<number>
  checkInput(input({ type: "number", default: 42 }), "number");

  // $ExpectType InputWithDefault<boolean>
  checkInput(input({ type: "boolean", default: true }), "boolean");

  // $ExpectType InputWithDefault<{ foo: string[]; }>
  input({
    type: object({ foo: array("string") }),
    default: { foo: ["bar"] },
  });
});

test("type and default and examples", () => {
  // $ExpectType InputWithDefault<string>
  checkInput(
    input({ type: "string", default: "foo", examples: ["a", "b"] }),
    "string",
    ["a", "b"]
  );

  // $ExpectType InputWithDefault<number>
  checkInput(
    input({ type: "number", default: 42, examples: [1, 2, 3] }),
    "number",
    [1, 2, 3]
  );

  // $ExpectType InputWithDefault<boolean>
  checkInput(
    input({ type: "boolean", default: true, examples: [true, false] }),
    "boolean",
    [true, false]
  );

  // $ExpectType InputWithDefault<{ foo: string[]; }>
  input({
    type: object({ foo: array("string") }),
    default: { foo: ["bar"] },
    examples: [{ foo: ["a"] }, { foo: ["b"] }],
  });
});

test("default doesn't match type", () => {
  input({
    // TODO(aomarks) Only default should error ideally.
    // @ts-expect-error
    type: "string",
    // @ts-expect-error
    default: 42,
  });

  input({
    // TODO(aomarks) Only default should error ideally.
    // @ts-expect-error
    type: "number",
    // @ts-expect-error
    default: true,
  });

  input({
    // TODO(aomarks) Only default should error ideally.
    // @ts-expect-error
    type: "boolean",
    // @ts-expect-error
    default: "foo",
  });

  input({
    type: object({ foo: array("string") }),
    default: {
      foo: [
        // @ts-expect-error
        42,
      ],
    },
  });
});

test("examples don't match type", () => {
  input({
    type: "string",
    examples: [
      // @ts-expect-error
      42,
    ],
  });

  input({
    type: "number",
    examples: [
      // @ts-expect-error
      true,
    ],
  });

  input({
    type: "boolean",
    examples: [
      // @ts-expect-error
      "foo",
    ],
  });

  input({
    type: object({ foo: array("string") }),
    // @ts-expect-error
    examples: [{ foo: [42] }],
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

test("invalid examples", () => {
  // @ts-expect-error
  input({ examples: undefined });

  // @ts-expect-error
  input({ examples: null });

  // @ts-expect-error
  input({ examples: { foo: "bar" } });
});
