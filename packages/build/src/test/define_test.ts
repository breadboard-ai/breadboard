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
import { OutputPortGetter, type OutputPortReference } from "../port.js";

test("expect types: 0 in, 0 out", () => {
  // $ExpectType NodeDefinition<{}, {}>
  const definition = defineNodeType({}, {}, () => ({}));
  // $ExpectType NodeInstance<{}, {}>
  const instance = definition({});
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
      // $ExpectType ConcreteValues<{ in1: { type: "string"; }; }>
      params;
      // $ExpectType string
      params.in1;
      return {};
    }
  );
  // $ExpectType NodeInstance<{ in1: { type: "string"; }; }, {}>
  const instance = definition({
    in1: "foo",
  });
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
  const instance = definition({});
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
      // $ExpectType ConcreteValues<{ in1: { type: "string"; }; }>
      params;
      // $ExpectType string
      params.in1;
      return {
        out1: "foo",
      };
    }
  );
  // $ExpectType NodeInstance<{ in1: { type: "string"; }; }, { out1: { type: "string"; }; }>
  const instance = definition({
    in1: "foo",
  });
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
      // $ExpectType ConcreteValues<{ in1: { type: "string"; }; in2: { type: "number"; }; }>
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
  const instance = definition({
    in1: "foo",
    in2: 123,
  });
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

test("expect type error: missing make instance param", () => {
  const definition = defineNodeType(
    {
      in1: {
        type: "string",
      },
      in2: {
        type: "number",
      },
    },
    {},
    () => {
      return {};
    }
  );
  // @ts-expect-error missing both
  definition();
  // @ts-expect-error missing both
  definition({});
  // @ts-expect-error missing in1
  definition({ in2: 123 });
  // @ts-expect-error missing in2
  definition({ in1: "foo" });
});

test("expect type error: incorrect make instance param type", () => {
  const definition = defineNodeType(
    {
      in1: {
        type: "string",
      },
      in2: {
        type: "number",
      },
    },
    {},
    () => {
      return {};
    }
  );
  definition({
    in1: "foo",
    // @ts-expect-error in2 should be number, not string
    in2: "123",
  });
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

{
  const definitionA = defineNodeType(
    {},
    {
      out1: {
        type: "string",
      },
      out2: {
        type: "number",
      },
    },
    () => {
      return {
        out1: "foo",
        out2: 123,
      };
    }
  );

  const definitionB = defineNodeType(
    {
      in1: {
        type: "string",
      },
      in2: {
        type: "number",
      },
    },
    {},
    () => {
      return {};
    }
  );

  const instanceA = definitionA({});
  const instanceB = definitionB({ in1: "foo", in2: 123 });

  test("can instantiate node with concrete values", () => {
    definitionB({
      in1: "foo",
      in2: 123,
    });
  });

  test("can instantiate node with output ports", () => {
    definitionB({
      in1: instanceA.outputs.out1,
      in2: instanceA.outputs.out2,
    });
  });

  test("can instantiate node with mix of concrete values and output ports", () => {
    definitionB({
      in1: "foo",
      in2: instanceA.outputs.out2,
    });
    definitionB({
      in1: instanceA.outputs.out1,
      in2: 123,
    });
  });

  test("expect error: instantiate with incorrectlty typed concrete value", () => {
    definitionB({
      // @ts-expect-error Expect string, got number
      in1: 123,
      in2: 123,
    });
    definitionB({
      in1: "foo",
      // @ts-expect-error Expect number, got string
      in2: "123",
    });
  });

  test("expect error: instantiate with incorrectly typed output port", () => {
    definitionB({
      // @ts-expect-error Expect string, got number
      in1: instanceA.outputs.out2,
      in2: instanceA.outputs.out2,
    });
    definitionB({
      in1: instanceA.outputs.out1,
      // @ts-expect-error Expect number, got string
      in2: instanceA.outputs.out1,
    });
  });

  test("expect error: wrong kind of port", () => {
    definitionB({
      // @ts-expect-error Expect OutputPort, got InputPort
      in1: instanceB.inputs.in1,
      // @ts-expect-error Expect OutputPort, got InputPort
      in2: instanceB.inputs.in2,
    });
  });
}

test("node with primary output acts like that output port", () => {
  const withPrimaryOut = defineNodeType(
    {
      in1: {
        type: "string",
      },
    },
    {
      out1: {
        type: "string",
      },
      out2: {
        type: "number",
        primary: true,
      },
      out3: {
        type: "boolean",
      },
    },
    () => {
      return {
        out1: "foo",
        out2: 123,
        out3: true,
      };
    }
  );
  const instance = withPrimaryOut({ in1: "foo" });
  instance satisfies OutputPortReference<{ type: "number" }>;
  // $ExpectType OutputPort<{ type: "number"; }>
  instance[OutputPortGetter];

  defineNodeType({ in1: { type: "number" } }, {}, () => ({}))({
    in1: instance,
  });

  defineNodeType({ in1: { type: "string" } }, {}, () => ({}))({
    // @ts-expect-error in1 expects string, not number
    in1: instance,
  });
});

test("type error: node without primary output doesn't act like an output port", () => {
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
  const instance = definition({ in1: "foo" });
  // @ts-expect-error no primary output, not an output
  instance satisfies OutputPortReference<{ type: "string" }>;
  assert.equal(
    // $ExpectType undefined
    instance[OutputPortGetter],
    undefined
  );
});
