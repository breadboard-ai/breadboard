/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { defineNodeType, input, output } from "@breadboard-ai/build";
import { test } from "node:test";
import { board, inputNode, outputNode } from "../internal/board/board.js";
import assert from "node:assert/strict";

const inStr = input();
const inNum = input({ type: "number" });

const testNode = defineNodeType({
  name: "example",
  inputs: {
    inStr: {
      type: "string",
    },
    inNum: {
      type: "number",
    },
  },
  outputs: {
    outNum: {
      type: "number",
    },
    outStr: {
      type: "string",
    },
  },
  invoke: () => {
    return {
      outNum: 123,
      outStr: "foo",
    };
  },
})({ inStr, inNum });
const { outNum, outStr } = testNode.outputs;

test("expect type: 0 in, 0 out", () => {
  // $ExpectType BoardDefinition<{}, {}>
  const definition = board({ inputs: {}, outputs: {} });
  // $ExpectType BoardInstance<{}, {}>
  definition({});
  // $ExpectType BoardInstance<{}, {}>
  const instance = definition({});
  // $ExpectType {}
  instance.outputs;
});

test("expect type: 1 in, 1 out", () => {
  // $ExpectType BoardDefinition<{ inStr: string; }, { outNum: number; }>
  const definition = board({ inputs: { inStr }, outputs: { outNum } });
  // NodeInstance<BoardPortConfig<{ inStr: InputPort<string>; }>, BoardPortConfig<{ outNum: OutputPort<{ type: "boolean"; }>; }>>
  const instance = definition({ inStr: "inStr" });
  // $ExpectType { outNum: Value<number>; }
  instance.outputs;
  // $ExpectType Value<number>
  instance.outputs.outNum;
});

test("expect type: nested boards", () => {
  const defA = board({ inputs: { inNum }, outputs: { outStr } });
  const defB = board({ inputs: { inStr }, outputs: { outNum } });
  const instanceA = defA({ inNum: 123 });
  // $ExpectType BoardInstance<{ inStr: string; }, { outNum: number; }>
  const instanceB = defB({ inStr: instanceA.outputs.outStr });
  // $ExpectType { outNum: Value<number>; }
  instanceB.outputs;
  // $ExpectType Value<number>
  instanceB.outputs.outNum;
});

test("expect type error: missing instantiate param", () => {
  const definition = board({ inputs: { inStr, inNum }, outputs: { outNum } });
  // @ts-expect-error missing both
  definition();
  // @ts-expect-error missing both
  definition({});
  // @ts-expect-error missing inStr
  definition({ inNum: 123 });
  // @ts-expect-error missing inNum
  definition({ inStr: "inStr" });
});

test("expect type error: board input/output types", () => {
  const noPrimary = defineNodeType({
    name: "noPrimary",
    inputs: {
      in: { type: "string" },
    },
    outputs: {
      out: { type: "string" },
    },
    invoke: () => ({ out: "foo" }),
  });

  board({
    // @ts-expect-error
    inputs: {
      in1: undefined,
      in2: null,
      in3: "foo",
      in4: noPrimary({ in: "foo" }),
    },
    // @ts-expect-error
    outputs: {
      out1: undefined,
      out2: null,
      out3: "foo",
      out4: noPrimary({ in: "foo" }),
    },
  });
});

test("expect type error: incorrect make instance param type", () => {
  const definition = board({ inputs: { inStr, inNum }, outputs: {} });
  definition({
    inStr: "foo",
    // @ts-expect-error inNum should be number, not string
    inNum: "123",
  });
});

test("allow setting title, description, version", () => {
  // $ExpectType BoardDefinition<{ inStr: string; }, { outNum: number; }>
  board({
    title: "My Title",
    description: "My Description",
    version: "1.0.0",
    inputs: { inStr },
    outputs: { outNum },
  });
});

{
  const boardA = board({ inputs: {}, outputs: { outNum, outStr } });
  const boardB = board({ inputs: { inStr, inNum }, outputs: {} });
  const instanceA = boardA({});
  const instanceB = boardB({ inStr: "foo", inNum: 123 });

  test("can instantiate node with concrete values", () => {
    boardB({
      inStr: "foo",
      inNum: 123,
    });
  });

  test("can instantiate node with output ports", () => {
    boardB({
      inStr: instanceA.outputs.outStr,
      inNum: instanceA.outputs.outNum,
    });
  });

  test("can instantiate node with mix of concrete values and output ports", () => {
    boardB({
      inStr: "foo",
      inNum: instanceA.outputs.outNum,
    });
    boardB({
      inStr: instanceA.outputs.outStr,
      inNum: 123,
    });
  });

  test("expect error: instantiate with incorrectlty typed concrete value", () => {
    boardB({
      // @ts-expect-error Expect string, got number
      inStr: 123,
      inNum: 123,
    });
    boardB({
      inStr: "foo",
      // @ts-expect-error Expect number, got string
      inNum: "123",
    });
  });

  test("expect error: instantiate with incorrectly typed output port", () => {
    boardB({
      // @ts-expect-error Expect string, got number
      inStr: instanceA.outputs.outNum,
      inNum: instanceA.outputs.outNum,
    });
    boardB({
      inStr: instanceA.outputs.outStr,
      // @ts-expect-error Expect number, got string
      inNum: instanceA.outputs.outStr,
    });
  });

  test("expect error: wrong kind of port", () => {
    boardB({
      // @ts-expect-error Expect OutputPort, got InputPort
      inStr: instanceB.inputs.inStr,
      // @ts-expect-error Expect OutputPort, got InputPort
      inNum: instanceB.inputs.inNum,
    });
  });
}

test("describe board", async () => {
  const inFoo = input({
    title: "Foo title",
    description: "Foo description",
    default: "Foo default",
    examples: ["Foo example 1", "Foo example 2"],
  });
  const boardA = board({
    inputs: { inFoo },
    outputs: {
      outNum,
      outStr: output(outStr, {
        description: "outStr description",
        title: "outStr title",
      }),
    },
  });
  const description = await boardA.describe();
  assert.deepEqual(description, {
    inputSchema: {
      type: "object",
      required: [],
      additionalProperties: false,
      properties: {
        inFoo: {
          type: "string",
          title: "Foo title",
          description: "Foo description",
          default: "Foo default",
          examples: ["Foo example 1", "Foo example 2"],
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["outNum", "outStr"],
      additionalProperties: false,
      properties: {
        outNum: {
          type: "number",
        },
        outStr: {
          type: "string",
          title: "outStr title",
          description: "outStr description",
        },
      },
    },
  });
});

test("polymorphic describe", async () => {
  const str = input();
  const num = input({ type: "number" });
  const bool = input({ type: "boolean" });
  const testBoard = board({
    inputs: [
      inputNode({ foo: str, bar: num }, { id: "in1" }),
      inputNode({ foo: str, bar: bool, baz: num }),
    ],
    outputs: [
      outputNode({ foo: num, bar: bool }, { id: "out1" }),
      outputNode({ foo: num, bar: str, baz: bool }),
    ],
  });
  const description = await testBoard.describe();
  assert.deepEqual(description, {
    inputSchema: {
      type: "object",
      properties: {
        foo: {
          type: "string",
        },
        bar: {
          type: ["number", "boolean"],
        },
        baz: {
          type: "number",
        },
      },
      required: ["foo", "bar"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        foo: {
          type: "number",
        },
        bar: {
          type: ["boolean", "string"],
        },
        baz: {
          type: "boolean",
        },
      },
      required: ["foo", "bar"],
      additionalProperties: false,
    },
  });
});
