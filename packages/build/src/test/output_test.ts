/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { board, outputNode } from "../internal/board/board.js";
import { output } from "../internal/board/output.js";
import { defineNodeType } from "../internal/define/define.js";
import { anyOf } from "../internal/type-system/any-of.js";
import { serialize } from "../internal/board/serialize.js";
import { input } from "../internal/board/input.js";

/* eslint-disable @typescript-eslint/ban-ts-comment */

test("output usage", () => {
  const strNode = defineNodeType({
    name: "foo",
    inputs: { foo: { type: "string", primary: true } },
    outputs: { foo: { type: "string", primary: true } },
    invoke: () => ({ foo: "foo" }),
  })({ foo: "foo" });

  // $ExpectType Output<string>
  output(strNode);
  // $ExpectType Output<string>
  output(strNode, { id: "foo" });
  // $ExpectType Output<string>
  output(strNode.outputs.foo, { id: "foo" });
  // $ExpectType Output<string>
  output(strNode.outputs.foo, {
    id: "foo",
    title: "My Title",
    description: "My Description",
  });

  const numNode = defineNodeType({
    name: "bar",
    inputs: { bar: { type: "number", primary: true } },
    outputs: { bar: { type: "number", primary: true } },
    invoke: () => ({ bar: 123 }),
  })({ bar: 123 });

  // $ExpectType Output<number>
  output(numNode);
  // $ExpectType Output<number>
  output(numNode, { id: "bar" });
  // $ExpectType Output<number>
  output(numNode.outputs.bar, { id: "bar" });
  // $ExpectType Output<number>
  output(numNode.outputs.bar, {
    id: "bar",
    title: "My Title",
    description: "My Description",
  });

  const multiNode = defineNodeType({
    name: "multi",
    inputs: {
      str: { type: "string" },
      num: { type: "number" },
    },
    outputs: {
      str: { type: "string", primary: true },
      num: { type: "number" },
    },
    invoke: () => ({ str: "foo", num: 123 }),
  })({ str: "foo", num: 123 });

  // $ExpectType Output<string>
  output(multiNode);
  // $ExpectType Output<string>
  output(multiNode, { id: "bar" });
  // $ExpectType Output<string>
  output(multiNode.outputs.str, { id: "bar" });
  // $ExpectType Output<string>
  output(multiNode.outputs.str, {
    id: "bar",
    title: "My Title",
    description: "My Description",
  });
  // $ExpectType Output<number>
  output(multiNode.outputs.num, { id: "bar" });
  // $ExpectType Output<number>
  output(multiNode.outputs.num, {
    id: "bar",
    title: "My Title",
    description: "My Description",
  });

  // @ts-expect-error
  output();

  // $ExpectType Output<null>
  output(null, { id: "foo" });

  output(strNode, {
    // @ts-expect-error
    id: 123,
  });

  output(strNode, {
    // @ts-expect-error
    title: 123,
  });

  output(strNode, {
    // @ts-expect-error
    description: 123,
  });

  output(strNode, {
    // @ts-expect-error
    unknown: 123,
  });

  output(strNode, {
    // @ts-expect-error
    id: null,
  });

  output(
    // @ts-expect-error
    strNode.outputs,
    { id: "foo" }
  );

  output(
    // @ts-expect-error
    strNode.inputs,
    { id: "foo" }
  );

  output(
    // @ts-expect-error
    strNode.inputs.foo,
    { id: "foo" }
  );
});

test("multi-output", () => {
  const { foo, bar, baz } = defineNodeType({
    name: "test",
    inputs: {},
    outputs: {
      foo: { type: "string" },
      bar: { type: "number" },
      baz: { type: "boolean" },
    },
    invoke: () => ({
      foo: "foo",
      bar: 123,
      baz: true,
    }),
  })({}).outputs;

  {
    // $ExpectType BoardDefinition<{}, { foo: string; bar: number; mix: string; } | { bar: number; baz: boolean; mix: number; }>
    const boardDef = board({
      inputs: {},
      outputs: [
        outputNode({
          foo,
          bar,
          mix: foo,
        }),
        outputNode(
          {
            bar,
            baz,
            mix: bar,
          },
          {
            id: "custom-output-name",
            title: "Custom Title",
            description: "Custom Description",
          }
        ),
      ],
    });

    assert.deepEqual(serialize(boardDef), {
      edges: [
        { from: "test-0", to: "custom-output-name", out: "bar", in: "bar" },
        { from: "test-0", to: "custom-output-name", out: "bar", in: "mix" },
        { from: "test-0", to: "custom-output-name", out: "baz", in: "baz" },
        { from: "test-0", to: "output-0", out: "bar", in: "bar" },
        { from: "test-0", to: "output-0", out: "foo", in: "foo" },
        { from: "test-0", to: "output-0", out: "foo", in: "mix" },
      ],
      nodes: [
        {
          id: "custom-output-name",
          metadata: {
            description: "Custom Description",
            title: "Custom Title",
          },
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                bar: { type: "number" },
                baz: { type: "boolean" },
                mix: { type: "number" },
              },
              required: ["bar", "baz", "mix"],
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
                bar: { type: "number" },
                foo: { type: "string" },
                mix: { type: "string" },
              },
              required: ["bar", "foo", "mix"],
            },
          },
        },
        { id: "test-0", type: "test", configuration: {} },
      ],
    });

    {
      // $ExpectType BoardInstance<{}, { foo: string; bar: number; mix: string; } | { bar: number; baz: boolean; mix: number; }>
      const boardInst = boardDef({});

      // $ExpectType { foo: Value<string | undefined>; bar: Value<number>; mix: Value<string | number>; baz: Value<boolean | undefined>; }
      boardInst.outputs;

      const {
        // $ExpectType Value<string | undefined>
        foo,
        // $ExpectType Value<number>
        bar,
        // $ExpectType Value<boolean | undefined>
        baz,
        // $ExpectType Value<string | number>
        mix,
      } = boardInst.outputs;

      defineNodeType({
        name: "test",
        inputs: {
          foo: { type: "string", optional: true },
          bar: { type: "number" },
          baz: { type: "boolean", optional: true },
          mix: { type: anyOf("string", "number") },
        },
        outputs: {},
        invoke: () => ({}),
      })({
        foo,
        bar,
        baz,
        mix,
      });
    }
  }
});

test("bubbling output node", () => {
  const foo = input();
  // $ExpectType OutputNode<{ foo: string; }>
  const bar = outputNode({ foo }, { bubble: true });
  const bgl = serialize(board({ inputs: { foo }, outputs: [bar] }));
  assert.deepEqual(bgl, {
    edges: [
      {
        from: "input-0",
        in: "foo",
        out: "foo",
        to: "output-0",
      },
    ],
    nodes: [
      {
        configuration: {
          schema: {
            properties: {
              foo: {
                type: "string",
              },
            },
            required: ["foo"],
            type: "object",
          },
        },
        id: "input-0",
        type: "input",
      },
      {
        configuration: {
          schema: {
            behavior: ["bubble"],
            properties: {
              foo: {
                type: "string",
              },
            },
            required: ["foo"],
            type: "object",
          },
        },
        id: "output-0",
        metadata: {},
        type: "output",
      },
    ],
  });
});

test("deprecated output port", () => {
  const foo = input();
  // $ExpectType Output<string>
  const bar = output(foo, { deprecated: true });
  const bgl = serialize(board({ inputs: { foo }, outputs: { bar } }));
  assert.deepEqual(bgl, {
    edges: [{ from: "input-0", to: "output-0", out: "foo", in: "bar" }],
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: { foo: { type: "string" } },
            required: ["foo"],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: { bar: { type: "string" } },
            required: ["bar"],
            behavior: ["deprecated"],
          },
        },
      },
    ],
  });
});
