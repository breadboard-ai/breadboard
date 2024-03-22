/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";
import type { NodeHandlerContext } from "@google-labs/breadboard";
import { test } from "node:test";
import assert from "node:assert/strict";

test("polymorphic inputs", () => {
  // $ExpectType PolymorphicDefinition<OmitDynamicPortConfig<{ in1: { type: "string"; }; "*": { type: "number"; }; }>, { type: "number"; }, { out1: { type: "string"; }; }>
  const definition = defineNodeType({
    inputs: {
      in1: {
        type: "string",
      },
      "*": {
        type: "number",
      },
    },
    outputs: {
      out1: {
        type: "string",
      },
    },
    invoke: (
      // $ExpectType ConcreteValues<OmitDynamicPortConfig<{ in1: { type: "string"; }; "*": { type: "number"; }; }>>
      params,
      // $ExpectType DynamicInvokeParams<OmitDynamicPortConfig<{ in1: { type: "string"; }; "*": { type: "number"; }; }>, { type: "number"; }>
      dynamic
    ) => {
      // $ExpectType string
      params.in1;
      // @ts-expect-error in2 is dynamic
      params.in2;
      // @ts-expect-error Not a real port
      params["*"];
      // $ExpectType never
      dynamic.in1;
      // $ExpectType number | undefined
      dynamic.in2;
      return {
        out1: "foo",
      };
    },
  });
  // @ts-expect-error missing required parameter
  definition({});
  definition({ in1: "foo" });
  definition({ in1: "foo", in2: 123 });
  definition({
    in1: "foo",
    // @ts-expect-error expected number, got string
    in2: "123",
  });
  definition({
    in1: "foo",
    // @ts-expect-error expected number, got null
    in2: null,
  });
  const instance = definition({ in1: "foo", in2: 123 });
  // @ts-expect-error Wildcard port isn't real
  instance.inputs["*"];
  // $ExpectType InputPort<{ type: "string"; }>
  instance.inputs.in1;
  // @ts-expect-error dynamic ports not exposed
  instance.inputs.in2;
  // @ts-expect-error No such port
  instance.inputs.in3;

  const definition2 = defineNodeType({
    inputs: {},
    outputs: {
      strOut: {
        type: "string",
      },
      numOut: {
        type: "number",
      },
    },
    invoke: () => {
      return {
        strOut: "foo",
        numOut: 123,
      };
    },
  });
  const instance2 = definition2({});
  definition({ in1: "foo", in2: instance2.outputs.numOut });
  // @ts-expect-error expected number, got string
  definition({ in1: "foo", in2: instance2.outputs.strOut });
  // @ts-expect-error expected number, got instance
  definition({ in1: "foo", in2: instance2 });
});

test("polymorphic inputs invoke returns value from sync function", async () => {
  const definition = defineNodeType({
    inputs: {
      in1: {
        type: "string",
      },
      "*": {
        type: "number",
      },
    },
    outputs: {
      out1: {
        type: "string",
      },
    },
    invoke: (staticParams, dynamicParams) => {
      return {
        out1:
          JSON.stringify(staticParams) + "\n" + JSON.stringify(dynamicParams),
      };
    },
  });
  const result = definition.invoke(
    { in1: "foo", in2: "bar" },
    // Not currently used.
    null as unknown as NodeHandlerContext
  );
  assert(result instanceof Promise);
  assert.deepEqual(await result, {
    out1: `{"in1":"foo"}\n{"in2":"bar"}`,
  });
});

test("polymorphic inputs invoke returns value from async function", async () => {
  const definition = defineNodeType({
    inputs: {
      in1: {
        type: "string",
      },
      "*": {
        type: "number",
      },
    },
    outputs: {
      out1: {
        type: "string",
      },
    },
    invoke: async (staticParams, dynamicParams) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return {
        out1:
          JSON.stringify(staticParams) + "\n" + JSON.stringify(dynamicParams),
      };
    },
  });
  const result = definition.invoke(
    { in1: "foo", in2: "bar" },
    // Not currently used.
    null as unknown as NodeHandlerContext
  );
  assert(result instanceof Promise);
  assert.deepEqual(await result, {
    out1: `{"in1":"foo"}\n{"in2":"bar"}`,
  });
});

test("polymorphic describe function generates JSON schema with static ports", async () => {
  const definition = defineNodeType({
    inputs: {
      in1: {
        type: "string",
        description: "Description of in1",
      },
      "*": {
        type: "boolean",
      },
    },
    outputs: {
      out1: {
        type: "boolean",
        description: "Description of out1",
      },
    },
    invoke: () => {
      return {
        out1: true,
      };
    },
  });
  assert.deepEqual(await definition.describe(), {
    inputSchema: {
      type: "object",
      properties: {
        in1: {
          title: "in1",
          description: "Description of in1",
          type: "string",
        },
      },
      required: ["in1"],
    },
    outputSchema: {
      type: "object",
      properties: {
        out1: {
          title: "out1",
          description: "Description of out1",
          type: "boolean",
        },
      },
      required: ["out1"],
    },
  });
});

test("polymorphic describe function generates JSON schema from static input", async () => {
  const definition = defineNodeType({
    inputs: {
      portList: {
        type: "string",
        description: "Comma-separated list of port names",
      },
      "*": {
        type: "number",
      },
    },
    outputs: {
      sum: {
        type: "number",
        description: "Sum of all input port values",
      },
    },
    invoke: ({ portList }, dynamic) => {
      // $ExpectType string
      portList;
      return {
        sum: Object.values(dynamic).reduce((prev, cur) => prev + cur, 0),
      };
    },
    describe: ({ portList }) => {
      // $ExpectType string | undefined
      portList;
      // TODO(aomarks) Maybe it should be possible to just return an array of
      // port names, and it will automatically assign the base type.
      return {
        inputs: Object.fromEntries(
          (portList ?? "").split(",").map((name) => [name, { type: "number" }])
        ),
      };
    },
  });
  assert.deepEqual(await definition.describe({ portList: `num1,num2` }), {
    inputSchema: {
      type: "object",
      properties: {
        portList: {
          title: "portList",
          description: "Comma-separated list of port names",
          type: "string",
        },
        num1: {
          title: "num1",
          type: "number",
        },
        num2: {
          title: "num2",
          type: "number",
        },
      },
      required: ["portList", "num1", "num2"],
    },
    outputSchema: {
      type: "object",
      properties: {
        sum: {
          title: "sum",
          description: "Sum of all input port values",
          type: "number",
        },
      },
      required: ["sum"],
    },
  });
  assert.deepEqual(
    await definition.invoke(
      { portList: `num1,num2`, num1: 2, num2: 1 },
      // TODO(aomarks) Not used yet
      undefined as unknown as NodeHandlerContext
    ),
    { sum: 3 }
  );
});
