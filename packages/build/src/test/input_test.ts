/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anyOf,
  array,
  board,
  defineNodeType,
  object,
  serialize,
} from "../index.js";
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
    input({ description: "Description" }),
    "string"
  );

  checkInput(
    // $ExpectType Input<string>
    input({ title: "Title" }),
    "string"
  );

  checkInput(
    // $ExpectType Input<string>
    input({ description: "Description", title: "Title" }),
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
  input({ type: null });

  // @ts-expect-error
  input({ type: "foo" });
});

test("invalid defaults", () => {
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
  input({ examples: null });

  // @ts-expect-error
  input({ examples: { foo: "bar" } });
});

test("multiple input nodes with ids and metadata", () => {
  const a = input();
  const b = input({ type: "number" });
  const c = input({ type: "boolean" });

  const { d } = defineNodeType({
    name: "test",
    inputs: {
      a: { type: "string" },
      b: { type: "number" },
      c: { type: "boolean" },
    },
    outputs: {
      d: { type: "string" },
    },
    invoke: () => ({ d: "foo" }),
  })({ a, b, c }).outputs;

  // $ExpectType BoardDefinition<{ a: Input<string | undefined>; b: Input<number | undefined>; c: Input<boolean>; }, { d: OutputPort<string>; }>
  const brd = board({
    inputs: [
      { a, b, c },
      {
        $id: "foo",
        $metadata: { title: "Foo Title", description: "Foo Desc" },
        b,
        c,
      },
      { c, a },
    ],
    outputs: {
      d,
    },
  });
  assert.deepEqual(serialize(brd), {
    edges: [
      { from: "foo", to: "test-0", out: "b", in: "b" },
      { from: "input-1", to: "test-0", out: "a", in: "a" },
      { from: "input-1", to: "test-0", out: "c", in: "c" },
      { from: "test-0", to: "output-0", out: "d", in: "d" },
    ],
    nodes: [
      {
        id: "foo",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: { b: { type: "number" }, c: { type: "boolean" } },
            required: ["b", "c"],
          },
        },
        metadata: { title: "Foo Title", description: "Foo Desc" },
      },
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              a: { type: "string" },
              b: { type: "number" },
              c: { type: "boolean" },
            },
            required: ["a", "b", "c"],
          },
        },
      },
      {
        id: "input-1",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: { a: { type: "string" }, c: { type: "boolean" } },
            required: ["a", "c"],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: { d: { type: "string" } },
            required: ["d"],
          },
        },
      },
      { id: "test-0", type: "test", configuration: {} },
    ],
  });
});

test("can't be optional with default", () => {
  input({ optional: true, type: "string" });
  // @ts-expect-error
  input({ optional: true, type: "string", default: "foo" });
  // @ts-expect-error
  input({ optional: true, default: "foo" });
});

test("optional inputs aren't required in JSON schema", () => {
  const req = input({ type: "number" });
  const opt = input({ type: "number", optional: true });

  const { baz } = defineNodeType({
    name: "test",
    inputs: {
      foo: { type: "number" },
      bar: { type: "number" },
    },
    outputs: {
      baz: { type: "number" },
    },
    invoke: () => ({ baz: 123 }),
  })({ foo: req, bar: opt }).outputs;

  // $ExpectType BoardDefinition<{ req: Input<number>; opt: Input<number>; }, { baz: OutputPort<number>; }>
  const brd = board({
    inputs: {
      req,
      opt,
    },
    outputs: {
      baz,
    },
  });
  assert.deepEqual(serialize(brd), {
    edges: [
      { from: "input-0", to: "test-0", out: "opt", in: "bar" },
      { from: "input-0", to: "test-0", out: "req", in: "foo" },
      { from: "test-0", to: "output-0", out: "baz", in: "baz" },
    ],
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              opt: { type: "number" },
              req: { type: "number" },
            },
            required: ["req"],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: { baz: { type: "number" } },
            required: ["baz"],
          },
        },
      },
      { id: "test-0", type: "test", configuration: {} },
    ],
  });
});
