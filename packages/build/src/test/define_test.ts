/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";
import { test } from "node:test";
import type {
  NodeDescriberFunction,
  NodeHandler,
  NodeHandlerContext,
  NodeHandlerFunction,
} from "@google-labs/breadboard";
import assert from "node:assert/strict";

test("expect types: 0 in, 0 out", () => {
  // $ExpectType NodeDefinition<{}, {}>
  const definition = defineNodeType({}, {}, () => ({}));
  // $ExpectType NodeInstance<{}, {}>
  const instance = definition();
  // $ExpectType InputPorts<{}>
  instance.inputs;
  // $ExpectType OutputPorts<{}>
  instance.outputs;
});

test("expect types: 1 in, 0 out", () => {
  // $ExpectType NodeDefinition<{ in1: { type: "string"; }; }, {}>
  const definition = defineNodeType(
    {
      in1: {
        type: "string",
      },
    },
    {},
    (params) => {
      // $ExpectType InvokeParams<{ in1: { type: "string"; }; }>
      params;
      // $ExpectType string
      params.in1;
      return {};
    }
  );
  // $ExpectType NodeInstance<{ in1: { type: "string"; }; }, {}>
  const instance = definition();
  // $ExpectType InputPorts<{ in1: { type: "string"; }; }>
  instance.inputs;
  // $ExpectType InputPort<{ type: "string"; }>
  instance.inputs.in1;
  // $ExpectType OutputPorts<{}>
  instance.outputs;
});

test("expect types: 0 in, 1 out", () => {
  // $ExpectType NodeDefinition<{}, { out1: { type: "string"; }; }>
  const definition = defineNodeType(
    {},
    {
      out1: {
        type: "string",
      },
    },
    () => {
      return {
        out1: "foo",
      };
    }
  );
  // $ExpectType NodeInstance<{}, { out1: { type: "string"; }; }>
  const instance = definition();
  // $ExpectType InputPorts<{}>
  instance.inputs;
  // $ExpectType OutputPorts<{ out1: { type: "string"; }; }>
  instance.outputs;
  // $ExpectType OutputPort<{ type: "string"; }>
  instance.outputs.out1;
});

test("expect types: 1 in, 1 out", () => {
  // $ExpectType NodeDefinition<{ in1: { type: "string"; }; }, { out1: { type: "string"; }; }>
  const definition = defineNodeType(
    {
      in1: {
        type: "string",
      },
    },
    {
      out1: {
        type: "string",
      },
    },
    (params) => {
      // $ExpectType InvokeParams<{ in1: { type: "string"; }; }>
      params;
      // $ExpectType string
      params.in1;
      return {
        out1: "foo",
      };
    }
  );
  // $ExpectType NodeInstance<{ in1: { type: "string"; }; }, { out1: { type: "string"; }; }>
  const instance = definition();
  // $ExpectType InputPorts<{ in1: { type: "string"; }; }>
  instance.inputs;
  // $ExpectType InputPort<{ type: "string"; }>
  instance.inputs.in1;
  // $ExpectType OutputPorts<{ out1: { type: "string"; }; }>
  instance.outputs;
  // $ExpectType OutputPort<{ type: "string"; }>
  instance.outputs.out1;
});

test("expect types: 2 in, 2 out", () => {
  // $ExpectType NodeDefinition<{ in1: { type: "string"; }; in2: { type: "number"; }; }, { out1: { type: "boolean"; }; out2: { type: "string"; }; }>
  const definition = defineNodeType(
    {
      in1: {
        type: "string",
      },
      in2: {
        type: "number",
      },
    },
    {
      out1: {
        type: "boolean",
      },
      out2: {
        type: "string",
      },
    },
    (params) => {
      // $ExpectType InvokeParams<{ in1: { type: "string"; }; in2: { type: "number"; }; }>
      params;
      // $ExpectType string
      params.in1;
      // $ExpectType number
      params.in2;
      return {
        out1: true,
        out2: "foo",
      };
    }
  );
  // $ExpectType NodeInstance<{ in1: { type: "string"; }; in2: { type: "number"; }; }, { out1: { type: "boolean"; }; out2: { type: "string"; }; }>
  const instance = definition();
  // $ExpectType InputPorts<{ in1: { type: "string"; }; in2: { type: "number"; }; }>
  instance.inputs;
  // $ExpectType InputPort<{ type: "string"; }>
  instance.inputs.in1;
  // $ExpectType InputPort<{ type: "number"; }>
  instance.inputs.in2;
  // $ExpectType OutputPorts<{ out1: { type: "boolean"; }; out2: { type: "string"; }; }>
  instance.outputs;
  // $ExpectType OutputPort<{ type: "boolean"; }>
  instance.outputs.out1;
  // $ExpectType OutputPort<{ type: "string"; }>
  instance.outputs.out2;
});

test("expect type error: unknown invoke param", () => {
  defineNodeType(
    {
      in1: {
        type: "string",
      },
    },
    {
      out1: {
        type: "string",
      },
    },
    (params) => {
      // @ts-expect-error No such port
      params.in2;
      return {
        out1: "foo",
      };
    }
  );
});

test("expect type error: missing invoke return port", () => {
  defineNodeType(
    {
      in1: {
        type: "string",
      },
    },
    {
      out1: {
        type: "string",
      },
    },
    // @ts-expect-error out1 missing
    () => {
      return {};
    }
  );
});

test("expect type error: incorrect invoke return port type", () => {
  defineNodeType(
    {
      in1: {
        type: "string",
      },
    },
    {
      out1: {
        type: "string",
      },
    },
    // @ts-expect-error out1 was number instead of string
    () => {
      return {
        out1: 123,
      };
    }
  );
});

test.skip("expect type error: unknown return port", () => {
  defineNodeType(
    {
      in1: {
        type: "string",
      },
    },
    {
      out1: {
        type: "string",
      },
    },
    // SKIP: @ts-expect-error out2 is not defined
    //
    // TODO(aomarks) Is it possible to enforce a compile-time check for excess
    // properties here, or is it not possible in this context?
    () => {
      return {
        out1: "foo",
        out2: "foo",
      };
    }
  );
});

test("expect types: definitions are NodeHandlers", () => {
  const definition = defineNodeType(
    {
      in1: {
        type: "string",
      },
    },
    {
      out1: {
        type: "string",
      },
    },
    () => {
      return {
        out1: "foo",
      };
    }
  );
  definition satisfies NodeHandler;
  definition.invoke satisfies NodeHandlerFunction;
  definition.describe satisfies NodeDescriberFunction;
});

test("describe function generates JSON schema", async () => {
  const definition = defineNodeType(
    {
      in1: {
        type: "string",
        description: "Description of in1",
      },
      in2: {
        type: "number",
      },
    },
    {
      out1: {
        type: "boolean",
        description: "Description of out1",
      },
    },
    () => {
      return {
        out1: true,
      };
    }
  );
  assert.deepEqual(await definition.describe(), {
    inputSchema: {
      type: "object",
      properties: {
        in1: {
          title: "in1",
          description: "Description of in1",
          type: "string",
        },
        in2: {
          title: "in2",
          description: undefined,
          type: "number",
        },
      },
      required: ["in1", "in2"],
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

test("invoke returns value from sync function", async () => {
  const definition = defineNodeType(
    {
      a: {
        type: "string",
      },
      b: {
        type: "string",
      },
    },
    {
      concat: {
        type: "string",
      },
    },
    // Synchronous
    ({ a, b }) => {
      return {
        concat: a + b,
      };
    }
  );
  const result = definition.invoke(
    { a: "foo", b: "bar" },
    // Not currently used.
    null as unknown as NodeHandlerContext
  );
  assert(result instanceof Promise);
  assert.deepEqual(await result, { concat: "foobar" });
});

test("invoke returns value from async function", async () => {
  const definition = defineNodeType(
    {
      a: {
        type: "string",
      },
      b: {
        type: "string",
      },
    },
    {
      concat: {
        type: "string",
      },
    },
    async ({ a, b }) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return {
        concat: a + b,
      };
    }
  );
  const result = definition.invoke(
    { a: "foo", b: "bar" },
    // Not currently used.
    null as unknown as NodeHandlerContext
  );
  assert(result instanceof Promise);
  assert.deepEqual(await result, { concat: "foobar" });
});
