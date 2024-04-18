/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  defineNodeType,
  type NodeFactoryFromDefinition,
} from "@breadboard-ai/build";
import {
  addKit,
  asRuntimeKit,
  board,
  Board,
  inspect,
} from "@google-labs/breadboard";
import { KitBuilder } from "@google-labs/breadboard/kits";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Definition } from "../internal/define/definition.js";

function setupKits<
  DEFS extends Record<
    string,
    // TODO(aomarks) See TODO about `any` at {@link NodeFactoryFromDefinition}.
    //
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Definition<any, any, any, any, any, any, any>
  >,
>(definitions: DEFS) {
  const ctr = new KitBuilder({ url: "N/A" }).build(definitions);
  return {
    kit: addKit(ctr) as {
      [NAME in keyof DEFS]: NodeFactoryFromDefinition<DEFS[NAME]>;
    },
    runtimeKit: asRuntimeKit(ctr),
  };
}

{
  // A monomorphic node definition
  const strLen = defineNodeType({
    name: "example",
    inputs: {
      str: {
        type: "string",
      },
    },
    outputs: {
      len: {
        type: "number",
      },
    },
    invoke: ({ str }) => {
      return {
        len: str.length,
      };
    },
  });

  const { kit: strLenKit, runtimeKit: strLenRuntimeKit } = setupKits({
    strLen,
  });
  // $ExpectType { strLen: NodeFactory<{ str: string; }, { len: number; }>; }
  strLenKit;
  // $ExpectType Lambda<InputValues, Required<{ boardLen: number; }>>
  const strLenBoard = await board(({ str }) => {
    const { len } = strLenKit.strLen({ str: str?.isString() });
    // TODO(aomarks) Can we provide a type to len automatically?
    return { boardLen: len.isNumber() };
  });
  const strLenSerialized = await strLenBoard.serialize();

  test("monomorphic result via BoardRunner", async () => {
    const runner = await Board.fromGraphDescriptor(strLenSerialized);
    const result = await runner.runOnce(
      { str: "12345" },
      { kits: [strLenRuntimeKit] }
    );
    assert.deepEqual(result, { boardLen: 5 });
  });

  test("monomorphic board schema via inspector", async () => {
    const inspectable = inspect(strLenSerialized, { kits: [strLenRuntimeKit] });
    assert.deepEqual(await inspectable.describe(), {
      inputSchema: {
        properties: {
          str: {
            title: "str",
            type: "string",
          },
        },
        required: ["str"],
        type: "object",
      },
      outputSchema: {
        additionalProperties: false,
        properties: {
          boardLen: {
            title: "len",
            type: "number",
          },
        },
        type: "object",
      },
    });
  });

  test("monomorphic node schema via inspector", async () => {
    const inspectable = inspect(strLenSerialized, { kits: [strLenRuntimeKit] });
    const descriptors = inspectable.nodesByType("strLen");
    assert.equal(descriptors.length, 1);
    const descriptor = descriptors[0]!;
    assert.deepEqual(await descriptor.describe(), {
      inputSchema: {
        properties: {
          str: {
            title: "str",
            type: "string",
          },
        },
        required: ["str"],
        type: "object",
      },
      outputSchema: {
        properties: {
          len: {
            title: "len",
            type: "number",
          },
        },
        required: ["len"],
        type: "object",
      },
    });
  });
}

{
  // A polymorphic node definition
  const adder = defineNodeType({
    name: "example",
    inputs: {
      base: {
        type: "number",
      },
      "*": {
        type: "number",
      },
    },
    outputs: {
      sum: {
        type: "number",
      },
    },
    invoke: ({ base }, operands) => {
      return {
        sum: Object.values(operands).reduce((sum, num) => sum + num, base),
      };
    },
  });

  const { kit: adderKit, runtimeKit: adderRuntimeKit } = setupKits({
    adder,
  });
  // $ExpectType { adder: NodeFactory<{ [x: string]: unknown; base: number; }, { sum: number; }>; }
  adderKit;
  // $ExpectType Lambda<InputValues, Required<{ boardSum: number; }>>
  const adderBoard = await board(({ num1, num2, num3 }) => {
    const { sum } = adderKit.adder({
      base: 0,
      num1: num1!.isNumber(),
      num2: num2!.isNumber(),
      num3: num3!.isNumber(),
    });
    // TODO(aomarks) Can we provide a type to sum automatically?
    return { boardSum: sum.isNumber() };
  });
  const adderSerialized = await adderBoard.serialize();

  test("polymorphic result via BoardRunner", async () => {
    const runner = await Board.fromGraphDescriptor(adderSerialized);
    const result = await runner.runOnce(
      { num1: 1, num2: 2, num3: 3 },
      { kits: [adderRuntimeKit] }
    );
    assert.deepEqual(result, { boardSum: 6 });
  });

  test("polymorphic board schema via inspector", async () => {
    const inspectable = inspect(adderSerialized, { kits: [adderRuntimeKit] });
    assert.deepEqual(await inspectable.describe(), {
      inputSchema: {
        properties: {
          num1: {
            title: "num1",
            type: "number",
          },
          num2: {
            title: "num2",
            type: "number",
          },
          num3: {
            title: "num3",
            type: "number",
          },
        },
        required: ["num1", "num2", "num3"],
        type: "object",
      },
      outputSchema: {
        additionalProperties: false,
        properties: {
          boardSum: {
            title: "sum",
            type: "number",
          },
        },
        type: "object",
      },
    });
  });

  test("polymorphic node schema via inspector", async () => {
    const inspectable = inspect(adderSerialized, { kits: [adderRuntimeKit] });
    const descriptors = inspectable.nodesByType("adder");
    assert.equal(descriptors.length, 1);
    const descriptor = descriptors[0]!;
    assert.deepEqual(await descriptor.describe(), {
      inputSchema: {
        properties: {
          base: {
            title: "base",
            type: "number",
          },
          // TODO(aomarks) Shouldn't num1, num2, num3 show up here?
        },
        required: ["base"],
        type: "object",
      },
      outputSchema: {
        properties: {
          sum: {
            title: "sum",
            type: "number",
          },
        },
        required: ["sum"],
        type: "object",
      },
    });
  });
}
