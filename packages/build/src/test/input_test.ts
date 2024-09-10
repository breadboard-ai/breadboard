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
  output,
  serialize,
} from "../index.js";
import { inputNode } from "../internal/board/board.js";
import {
  input,
  rawInput,
  type GenericSpecialInput,
} from "../internal/board/input.js";
import { jsonSchema } from "../internal/type-system/json-schema.js";
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

  // $ExpectType Input<string | undefined>
  checkInput(input({ optional: true }), "string");

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

  // $ExpectType Input<string | undefined>
  checkInput(input({ type: "string", optional: true }), "string");

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

test("just examples", () => {
  // $ExpectType Input<number>
  checkInput(input({ examples: [1, 2] }), "number", [1, 2]);

  // $ExpectType Input<number | undefined>
  checkInput(input({ examples: [1, 2], optional: true }), "number", [1, 2]);
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

  // $ExpectType BoardDefinition<{ a: string; b: number; c: boolean; } | { b: number; c: boolean; } | { c: boolean; a: string; }, { d: string; }>
  const brd = board({
    inputs: [
      inputNode({ a, b, c }),
      inputNode(
        {
          b,
          c,
        },
        {
          id: "foo",
          title: "Foo Title",
          description: "Foo Desc",
        }
      ),
      inputNode({ c, a }),
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

  // $ExpectType Definition<{ foo: number; bar: number; }, { baz: number; }, undefined, undefined, "bar", false, false, false, { foo: { board: false; }; bar: { board: false; }; }>
  const def = defineNodeType({
    name: "test",
    inputs: {
      foo: { type: "number" },
      bar: { type: "number", optional: true },
    },
    outputs: {
      baz: { type: "number" },
    },
    invoke: () => ({ baz: 123 }),
  });

  const { baz } = def({ foo: req, bar: opt }).outputs;

  // $ExpectType BoardDefinition<{ opt?: number | undefined; req: number; }, { baz: number; }>
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

test("input directly to output", () => {
  const foo = input();
  const bar = input({ type: "number", default: 42 });
  const brd = board({
    inputs: { fooIn: foo, barIn: bar },
    outputs: { fooOut: foo, barOut: bar },
  });
  assert.deepEqual(serialize(brd), {
    edges: [
      { from: "input-0", to: "output-0", out: "barIn", in: "barOut" },
      { from: "input-0", to: "output-0", out: "fooIn", in: "fooOut" },
    ],
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              barIn: { type: "number", default: "42" },
              fooIn: { type: "string" },
            },
            required: ["fooIn"],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              barOut: { type: "number" },
              fooOut: { type: "string" },
            },
            required: ["barOut", "fooOut"],
          },
        },
      },
    ],
  });
});

test("input directly to output with description", () => {
  const foo = input({ description: "Foo IN" });
  const bar = input({ type: "number", description: "Bar IN", default: 42 });
  const brd = board({
    inputs: { fooIn: foo, barIn: bar },
    outputs: {
      fooOut: output(foo, { description: "Foo OUT" }),
      barOut: output(bar, { description: "Bar OUT" }),
    },
  });
  assert.deepEqual(serialize(brd), {
    edges: [
      { from: "input-0", to: "output-0", out: "barIn", in: "barOut" },
      { from: "input-0", to: "output-0", out: "fooIn", in: "fooOut" },
    ],
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              barIn: { type: "number", description: "Bar IN", default: "42" },
              fooIn: { type: "string", description: "Foo IN" },
            },
            required: ["fooIn"],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              barOut: { type: "number", description: "Bar OUT" },
              fooOut: { type: "string", description: "Foo OUT" },
            },
            required: ["barOut", "fooOut"],
          },
        },
      },
    ],
  });
});

test("can create and serialize a raw input", () => {
  const schema = input({ type: jsonSchema });
  // $ExpectType Instance<{ schema: Schema; }, {}, JsonSerializable, false, false, false>
  const raw = rawInput({ $metadata: { title: "A regular old input" }, schema });
  const bgl = serialize(
    board({
      inputs: { schema },
      outputs: {
        foo: raw.unsafeOutput("foo"),
      },
    })
  );
  assert.deepEqual(bgl, {
    edges: [
      { from: "input-0", to: "input-1", out: "schema", in: "schema" },
      { from: "input-1", to: "output-0", out: "foo", in: "foo" },
    ],
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              schema: {
                jsonSchema: {
                  type: "object",
                  properties: {},
                  required: [],
                  additionalProperties: true,
                  behavior: ["json-schema"],
                },
              },
            },
            required: ["schema"],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              foo: {
                type: [
                  "array",
                  "boolean",
                  "null",
                  "number",
                  "object",
                  "string",
                ],
              },
            },
            required: ["foo"],
          },
        },
      },
      {
        id: "input-1",
        type: "input",
        configuration: {},
        metadata: { title: "A regular old input" },
      },
    ],
  });
});
