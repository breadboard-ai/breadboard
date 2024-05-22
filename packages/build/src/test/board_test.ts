/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { defineNodeType } from "@breadboard-ai/build";
import { test } from "node:test";
import { board } from "../internal/board/board.js";
import assert from "node:assert/strict";

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
})({ inStr: "foo", inNum: 123 });
const { inStr, inNum } = testNode.inputs;
const { outNum, outStr } = testNode.outputs;

test("expect type: 0 in, 0 out", () => {
  // $ExpectType BoardDefinition<{}, {}>
  const definition = board({ inputs: {}, outputs: {} });
  // $ExpectType BoardInstance<{}, {}>
  definition({});
  // $ExpectType BoardInstance<{}, {}>
  const instance = definition({});
  // $ExpectType {}
  instance.inputs;
  // $ExpectType {}
  instance.outputs;
});

test("expect type: 1 in, 1 out", () => {
  // $ExpectType BoardDefinition<{ inStr: InputPort<string>; }, { outNum: OutputPort<number>; }>
  const definition = board({ inputs: { inStr }, outputs: { outNum } });
  // NodeInstance<BoardPortConfig<{ inStr: InputPort<string>; }>, BoardPortConfig<{ outNum: OutputPort<{ type: "boolean"; }>; }>>
  const instance = definition({ inStr: "inStr" });
  // $ExpectType { inStr: InputPort<string>; }
  instance.inputs;
  // $ExpectType InputPort<string>
  instance.inputs.inStr;
  // $ExpectType { outNum: OutputPort<number>; }
  instance.outputs;
  // $ExpectType OutputPort<number>
  instance.outputs.outNum;
});

test("expect type: nested boards", () => {
  const defA = board({ inputs: { inNum }, outputs: { outStr } });
  const defB = board({ inputs: { inStr }, outputs: { outNum } });
  const instanceA = defA({ inNum: 123 });
  // $ExpectType BoardInstance<{ inStr: InputPort<string>; }, { outNum: OutputPort<number>; }>
  const instanceB = defB({ inStr: instanceA.outputs.outStr });
  // $ExpectType { inStr: InputPort<string>; }
  instanceB.inputs;
  // $ExpectType InputPort<string>
  instanceB.inputs.inStr;
  // $ExpectType { outNum: OutputPort<number>; }
  instanceB.outputs;
  // $ExpectType OutputPort<number>
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

  assert.throws(() =>
    board({
      inputs: {
        // @ts-expect-error
        in1: undefined,
        // @ts-expect-error
        in2: null,
        // @ts-expect-error
        in3: "foo",
        // @ts-expect-error
        in4: noPrimary({}),
      },
      outputs: {
        // @ts-expect-error
        out1: undefined,
        // @ts-expect-error
        out2: null,
        // @ts-expect-error
        out3: "foo",
        // @ts-expect-error
        out4: noPrimary({}),
      },
    })
  );
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
  // $ExpectType BoardDefinition<{ inStr: InputPort<string>; }, { outNum: OutputPort<number>; }>
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
