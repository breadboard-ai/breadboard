/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { board, defineNodeType, input, serialize } from "@breadboard-ai/build";
import test from "ava";
import { code } from "@google-labs/core-kit";

test("usage", (t) => {
  const str = input();
  const num = input({ type: "number" });

  t.throws(() =>
    // @ts-expect-error
    code()
  );

  // $ExpectType CodeNode<{ str: string; num: number; }, { fwdStr: string; fwdNum: number; newBool: boolean; }>
  const c = code(
    { str, num },
    { fwdStr: "string", fwdNum: "number", newBool: "boolean" },
    (
      // $ExpectType { str: string; num: number; }
      params
    ) => {
      return {
        fwdStr:
          // $ExpectType string
          params.str,
        fwdNum:
          // $ExpectType number
          params.num,
        newBool: true,
      };
    }
  );

  code(
    { str, num },
    { fwdStr: "string", fwdNum: "number", newBool: "boolean" },
    // @ts-expect-error
    () => {
      return {};
    }
  );

  code(
    { str, num },
    { fwdStr: "string", fwdNum: "number", newBool: "boolean" },
    // @ts-expect-error
    () => {
      return {
        fwdStr: "foo",
        fwdNum: 123,
        newBool: "true",
      };
    }
  );

  t.truthy(
    // $ExpectType InputPort<string>
    c.inputs.code
  );
  t.truthy(
    // $ExpectType InputPort<string>
    c.inputs.str
  );
  t.truthy(
    // $ExpectType InputPort<number>
    c.inputs.num
  );

  t.truthy(
    // $ExpectType OutputPort<string>
    c.outputs.fwdStr
  );
  t.truthy(
    // $ExpectType OutputPort<number>
    c.outputs.fwdNum
  );
  t.truthy(
    // $ExpectType OutputPort<boolean>
    c.outputs.newBool
  );

  t.is(
    // @ts-expect-error
    c.outputs.notReal,
    undefined
  );

  t.pass();
});

test("serialization", (t) => {
  const str = input();
  const num = input({ type: "number" });

  // $ExpectType Definition<{ num: number; }, { halfNum: number; }, undefined, undefined, never, false, false, false, { num: { board: false; }; }>
  const otherNodeDef = defineNodeType({
    name: "other",
    inputs: {
      num: { type: "number" },
    },
    outputs: {
      halfNum: { type: "number" },
    },
    invoke: ({ num }) => ({ halfNum: num / 2 }),
  });

  const codeResult = code(
    {
      str,
      num,
      bool: false,
      $id: "customId",
      $metadata: {
        title: "Custom title",
        description: "Custom description",
      },
    },
    {
      strLen: "number",
      strReversed: "string",
      doubleNum: "number",
      not: "boolean",
    },
    ({ str, num, bool }) => ({
      strLen: str.length,
      strReversed: str.split("").reverse().join(""),
      doubleNum: num * 2,
      not: !bool,
    })
  );

  // $ExpectType OutputPort<string>
  codeResult.outputs.strReversed;

  otherNodeDef({
    // TODO(aomarks) This should be an error!
    num: codeResult.outputs.strReversed,
  });

  const otherNode = otherNodeDef({ num: codeResult.outputs.doubleNum });

  const bgl = serialize(
    board({
      inputs: { str, num },
      outputs: {
        out1: codeResult.outputs.strLen,
        out2: codeResult.outputs.strReversed,
        out3: codeResult.outputs.doubleNum,
        out4: codeResult.outputs.not,
        out5: otherNode.outputs.halfNum,
      },
    })
  );
  t.deepEqual(bgl, {
    edges: [
      { from: "customId", to: "other-0", out: "doubleNum", in: "num" },
      { from: "customId", to: "output-0", out: "doubleNum", in: "out3" },
      { from: "customId", to: "output-0", out: "not", in: "out4" },
      { from: "customId", to: "output-0", out: "strLen", in: "out1" },
      { from: "customId", to: "output-0", out: "strReversed", in: "out2" },
      { from: "input-0", to: "customId", out: "num", in: "num" },
      { from: "input-0", to: "customId", out: "str", in: "str" },
      { from: "other-0", to: "output-0", out: "halfNum", in: "out5" },
    ],
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: { num: { type: "number" }, str: { type: "string" } },
            required: ["num", "str"],
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
              out1: { type: "number" },
              out2: { type: "string" },
              out3: { type: "number" },
              out4: { type: "boolean" },
              out5: { type: "number" },
            },
            required: ["out1", "out2", "out3", "out4", "out5"],
          },
        },
      },
      {
        id: "customId",
        type: "runJavascript",
        configuration: {
          bool: false,
          code: 'const customId = ({ str, num, bool }) => ({\n        strLen: str.length,\n        strReversed: str.split("").reverse().join(""),\n        doubleNum: num * 2,\n        not: !bool,\n    });',
          name: "customId",
          raw: true,
        },
        metadata: { title: "Custom title", description: "Custom description" },
      },
      { id: "other-0", type: "other", configuration: {} },
    ],
  });
});

test("can return error", (t) => {
  code({}, { bar: "string" }, () => ({ $error: "oh no" }));
  code({}, { bar: "string" }, () => ({ $error: { message: "oh no" } }));

  code({}, { bar: "string" }, () => ({
    // @ts-expect-error
    $error: 123,
  }));
  code({}, { bar: "string" }, () => ({
    // @ts-expect-error
    $error: {},
  }));
  code({}, { bar: "string" }, () => ({
    $error: {
      // @ts-expect-error
      msg: "foo",
    },
  }));

  t.pass();
});
