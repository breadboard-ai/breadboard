/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { converge } from "../internal/board/converge.js";
import { input } from "../internal/board/input.js";
import { loopback } from "../internal/board/loopback.js";
import { defineNodeType } from "../internal/define/define.js";
import { serialize } from "../internal/board/serialize.js";
import { board } from "../internal/board/board.js";
import { array } from "../internal/type-system/array.js";
import { object } from "../internal/type-system/object.js";

/* eslint-disable @typescript-eslint/ban-ts-comment */

test("converge must have 2 or more arguments", () => {
  // @ts-expect-error
  converge();
  // @ts-expect-error
  converge(input());

  converge(input(), input());
  converge(input(), input(), input());
  converge(input(), input(), input(), input());
});

test("cannot converge undefined or something weird", () => {
  // @ts-expect-error
  converge(undefined, undefined);
  // @ts-expect-error
  converge(converge, converge);
});

test("can converge basic types", () => {
  // $ExpectType Convergence<string>
  converge("foo", "bar");
  // $ExpectType Convergence<number>
  converge(123, 456);
  // $ExpectType Convergence<null>
  converge(null, null);
  // $ExpectType Convergence<{ foo: string; } | {}>
  converge({}, input({ type: object({ foo: "string" }) }));
});

test("nested converge is not allowed", () => {
  // @ts-expect-error
  converge(converge(input(), input()), input());
});

test("converge creates a union of types", () => {
  // $ExpectType Convergence<string | number>
  converge(input(), input({ type: "number" }));
  // $ExpectType Convergence<string | number>
  converge(loopback(), loopback({ type: "number" }));
  // $ExpectType Convergence<string | number | { foo: number; }[] | { bar: boolean; }[]>
  converge(
    input(),
    loopback({ type: "number" }),
    input({ type: array(object({ foo: "number" })) }),
    loopback({ type: array(object({ bar: "boolean" })) })
  );
});

test("converge stores the ports in order", () => {
  const str = input();
  const num = input({ type: "number" });
  const bool = loopback({ type: "boolean" });
  assert.deepEqual(converge(str, num, bool).ports, [str, num, bool]);
  assert.deepEqual(converge(num, bool, str).ports, [num, bool, str]);
});

test("converge can be passed as node input", () => {
  const def = defineNodeType({
    name: "test",
    inputs: { foo: { type: "number" } },
    outputs: {},
    invoke: () => ({}),
  });
  def({
    foo: converge(input({ type: "number" }), input({ type: "number" })),
  });
});

test("converge of wrong type can't be passed as node input", () => {
  const def = defineNodeType({
    name: "test",
    inputs: { foo: { type: "number" } },
    outputs: {},
    invoke: () => ({}),
  });
  def({
    // @ts-expect-error
    foo: converge(123, "bar"),
  });
});

test("convergences are serialized as multiple edges", () => {
  const def = defineNodeType({
    name: "test",
    inputs: { foo: { type: "number" } },
    outputs: { bar: { type: "number" } },
    invoke: ({ foo }) => ({ bar: foo + 1 }),
  });
  const a = input({ type: "number" });
  const b = input({ type: "number" });
  const { bar } = def({
    foo: converge(a, 123, b),
  }).outputs;
  const brd = board({ inputs: { a, b }, outputs: { bar } });
  const bgl = serialize(brd);
  assert.deepEqual(bgl, {
    edges: [
      {
        from: "input-0",
        to: "test-0",
        out: "a",
        in: "foo",
      },
      {
        from: "input-0",
        to: "test-0",
        out: "b",
        in: "foo",
      },
      {
        from: "test-0",
        to: "output-0",
        in: "bar",
        out: "bar",
      },
    ],
    nodes: [
      {
        configuration: {
          schema: {
            properties: {
              a: {
                type: "number",
              },
              b: {
                type: "number",
              },
            },
            required: ["a", "b"],
            type: "object",
          },
        },
        id: "input-0",
        type: "input",
      },
      {
        configuration: {
          schema: {
            properties: {
              bar: {
                type: "number",
              },
            },
            required: ["bar"],
            type: "object",
          },
        },
        id: "output-0",
        type: "output",
      },
      {
        id: "test-0",
        type: "test",
        configuration: {
          foo: 123,
        },
      },
    ],
  });
});
