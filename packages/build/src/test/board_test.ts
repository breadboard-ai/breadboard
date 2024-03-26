/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from "node:test";
import { defineNodeType } from "@breadboard-ai/build";
import { board } from "../internal/board/board.js";

const testNode = defineNodeType({
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
  const definition = board({}, {});
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
  const definition = board({ inStr }, { outNum });
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
  const defA = board({ inNum }, { outStr });
  const defB = board({ inStr }, { outNum });
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
  const definition = board({ inStr, inNum }, { outNum });
  // @ts-expect-error missing both
  definition();
  // @ts-expect-error missing both
  definition({});
  // @ts-expect-error missing inStr
  definition({ inNum: 123 });
  // @ts-expect-error missing inNum
  definition({ inStr: "inStr" });
});

test("expect type error: incorrect make instance param type", () => {
  const definition = board({ inStr, inNum }, {});
  definition({
    inStr: "foo",
    // @ts-expect-error inNum should be number, not string
    inNum: "123",
  });
});

{
  const boardA = board({}, { outNum, outStr });
  const boardB = board({ inStr, inNum }, {});
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
