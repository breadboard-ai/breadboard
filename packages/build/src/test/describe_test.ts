/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { array, defineNodeType, unsafeSchema } from "@breadboard-ai/build";
import type { NodeDescriberContext, Schema } from "@google-labs/breadboard";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { NodeDescriberContextWithSchemas } from "../internal/define/describe.js";

/* eslint-disable @typescript-eslint/ban-ts-comment */

test("error: mono/mono should not have describe", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
    },
    // @ts-expect-error
    describe: () => ({ inputs: [], outputs: [] }),
    invoke: () => ({ so1: "so1" }),
  });
});

test("error: mono/poly must have describe", () => {
  // @ts-expect-error
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
      "*": { type: "number" },
    },
    invoke: () => ({ so1: "so1" }),
  });
});

test("error: non-reflective poly/poly must have describe", () => {
  // @ts-expect-error
  defineNodeType({
    name: "foo",
    inputs: {
      si1: { type: "string" },
      "*": { type: "string" },
    },
    outputs: {
      so1: { type: "string" },
      "*": { type: "string" },
    },
    invoke: () => ({ so1: "so1" }),
  });
});

test("describe is lenient with odd TypeScript types", () => {
  defineNodeType({
    name: "foo",
    inputs: {
      outputFoo: { type: "boolean" },
    },
    outputs: {
      "*": { type: "unknown" },
    },
    describe: ({ outputFoo }) => ({
      /** See {@link DynamicInputPorts} for why this is an interesting case. */
      outputs: outputFoo ? { foo: { description: "foo" } } : {},
    }),
    invoke: () => ({}),
  });
});

test("static input schema", async () => {
  assert.deepEqual(
    (
      await defineNodeType({
        name: "foo",
        inputs: { foo: { type: "string" } },
        outputs: {},
        invoke: () => ({}),
      }).describe()
    ).inputSchema,
    {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
        },
      },
      required: ["foo"],
      additionalProperties: false,
    }
  );
});

test("dynamic input schema with custom describe (closed)", async () => {
  assert.deepEqual(
    (
      await defineNodeType({
        name: "foo",
        inputs: {
          foo: { type: "string" },
          "*": { type: "number" },
        },
        outputs: {},
        describe: () => ({ inputs: ["bar"] }),
        invoke: () => ({}),
      }).describe()
    ).inputSchema,
    {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
        },
        bar: {
          title: "bar",
          type: "number",
        },
      },
      required: ["bar", "foo"],
      additionalProperties: false,
    }
  );
});

test("dynamic input schema with custom describe (open)", async () => {
  assert.deepEqual(
    (
      await defineNodeType({
        name: "foo",
        inputs: {
          foo: { type: "string" },
          "*": { type: "number" },
        },
        outputs: {},
        describe: () => ({ inputs: { "*": {} } }),
        invoke: () => ({}),
      }).describe()
    ).inputSchema,
    {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
        },
      },
      required: ["foo"],
      additionalProperties: { type: "number" },
    }
  );
});

test("dynamic input schema with default describe passed nothing", async () => {
  assert.deepEqual(
    (
      await defineNodeType({
        name: "foo",
        inputs: {
          foo: { type: "string" },
          "*": { type: "number" },
        },
        outputs: {},
        invoke: () => ({}),
      }).describe()
    ).inputSchema,
    {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
        },
      },
      required: ["foo"],
      additionalProperties: { type: "number" },
    }
  );
});

test("dynamic input schema with default describe passed values", async () => {
  assert.deepEqual(
    (
      await defineNodeType({
        name: "foo",
        inputs: {
          foo: { type: "string" },
          "*": { type: "number" },
        },
        outputs: {},
        invoke: () => ({}),
      }).describe({ a: 1, b: 2 })
    ).inputSchema,
    {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
        },
        a: {
          title: "a",
          type: "number",
        },
        b: {
          title: "b",
          type: "number",
        },
      },
      required: ["foo"],
      additionalProperties: { type: "number" },
    }
  );
});

test("dynamic input schema with default describe passed inbound edges", async () => {
  assert.deepEqual(
    (
      await defineNodeType({
        name: "foo",
        inputs: {
          foo: { type: "string" },
          "*": { type: "number" },
        },
        outputs: {},
        invoke: () => ({}),
      }).describe(undefined, {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "string" },
        },
      })
    ).inputSchema,
    {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
        },
        a: {
          title: "a",
          type: "number",
        },
        b: {
          title: "b",
          type: "string",
        },
      },
      required: ["foo"],
      additionalProperties: { type: "number" },
    }
  );
});

test("static output schema", async () => {
  assert.deepEqual(
    (
      await defineNodeType({
        name: "foo",
        inputs: {},
        outputs: { foo: { type: "string" } },
        invoke: () => ({ foo: "foo" }),
      }).describe()
    ).outputSchema,
    {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
        },
      },
      // TODO(aomarks) I think this should be required, but currently the visual
      // editor will show this in red, which doesn't seem right.
      // required: ["foo"],
      required: [],
      additionalProperties: false,
    }
  );
});

test("dynamic output schema with custom describe (closed)", async () => {
  assert.deepEqual(
    (
      await defineNodeType({
        name: "foo",
        inputs: {},
        outputs: {
          foo: { type: "string" },
          "*": { type: "number" },
        },
        describe: () => ({ outputs: ["bar"] }),
        invoke: () => ({ foo: "foo" }),
      }).describe()
    ).outputSchema,
    {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
        },
        bar: {
          title: "bar",
          type: "number",
        },
      },
      // TODO(aomarks) I think this should be required, but currently the visual
      // editor will show this in red, which doesn't seem right.
      // required: ["bar", "foo"],
      required: [],
      additionalProperties: false,
    }
  );
});

test("dynamic output schema with custom describe (open)", async () => {
  assert.deepEqual(
    (
      await defineNodeType({
        name: "foo",
        inputs: {},
        outputs: {
          foo: { type: "string" },
          "*": { type: "number" },
        },
        describe: () => ({ outputs: { "*": {} } }),
        invoke: () => ({ foo: "foo" }),
      }).describe()
    ).outputSchema,
    {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
        },
      },
      // TODO(aomarks) I think this should be required, but currently the visual
      // editor will show this in red, which doesn't seem right.
      // required: ["foo"],
      required: [],
      additionalProperties: { type: "number" },
    }
  );
});

test("async describe", async () => {
  assert.deepEqual(
    await defineNodeType({
      name: "foo",
      inputs: {
        "*": { type: "number" },
      },
      outputs: {
        "*": { type: "number" },
      },
      describe: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return {
          inputs: ["foo"],
          outputs: ["bar"],
        };
      },
      invoke: () => ({}),
    }).describe(),
    {
      inputSchema: {
        type: "object",
        properties: {
          foo: {
            title: "foo",
            type: "number",
          },
        },
        required: ["foo"],
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          bar: {
            title: "bar",
            type: "number",
          },
        },
        required: [],
        additionalProperties: false,
      },
    }
  );
});

test("describe receives context", async () => {
  const input: NodeDescriberContext = {
    base: new URL("http://example.com/"),
    outerGraph: { nodes: [], edges: [] },
  };
  const expected: NodeDescriberContextWithSchemas = {
    base: new URL("http://example.com/"),
    outerGraph: { nodes: [], edges: [] },
    inputSchema: {},
    outputSchema: {},
  };
  let actual: NodeDescriberContext | undefined;
  defineNodeType({
    name: "foo",
    inputs: {
      "*": { type: "number" },
    },
    outputs: {
      "*": { type: "number" },
    },
    describe: (_staticInputs, _dynamicInputs, context) => {
      actual = context;
      return {
        inputs: [],
        outputs: [],
      };
    },
    invoke: () => ({}),
  }).describe({}, {}, {}, input);
  assert.deepEqual(actual, expected);
});

test("describe receives converted inputSchema and outputSchema and can return it", async () => {
  let actualContext: NodeDescriberContextWithSchemas | undefined;
  const testDefinition = defineNodeType({
    name: "foo",
    inputs: {
      "*": { type: "number" },
    },
    outputs: {
      "*": { type: "number" },
    },
    describe: (_staticInputs, _dynamicInputs, context) => {
      actualContext = context;
      return {
        // Solidfy that the actual input/output ports are valid by returning
        // them here so they show up in the description
        inputs: {
          ...context?.inputSchema,
          // Also continue to allow additional ports.
          "*": {},
        },
        outputs: {
          ...context?.outputSchema,
          // Stop allowing additional ports (no "*").
          // But do add some specific other property for some reason.
          new: {
            type: array("boolean"),
          },
        },
      };
    },
    invoke: () => ({}),
  });

  const testContext: NodeDescriberContext = {
    base: new URL("http://example.com/"),
    outerGraph: { nodes: [], edges: [] },
  };

  const testInputSchema: Schema = {
    type: "object",
    properties: {
      foo: {
        type: "string",
        default: "foo",
        format: "javascript",
        behavior: ["bubble"],
        ["weirdThing" as never]: 123,
      },
    },
  };
  const testOutputSchema: Schema = {
    type: "object",
    properties: {
      bar: {
        type: "number",
        ["anotherWeirdThing" as never]: 456,
      },
    },
  };

  const expectedContext: NodeDescriberContextWithSchemas = {
    base: new URL("http://example.com/"),
    outerGraph: { nodes: [], edges: [] },
    inputSchema: {
      foo: {
        type: {
          jsonSchema: {
            behavior: ["bubble"],
            default: "foo",
            format: "javascript",
            type: "string",
            weirdThing: 123,
          },
        },
        default: "foo",
        format: "javascript",
        behavior: ["bubble"],
      },
    },
    outputSchema: {
      bar: {
        type: {
          jsonSchema: {
            anotherWeirdThing: 456,
            type: "number",
          },
        },
      },
    },
  };

  const expectedDescription = {
    inputSchema: {
      type: "object",
      properties: {
        foo: {
          title: "foo",
          type: "string",
          default: "foo",
          behavior: ["bubble"],
          format: "javascript",
          weirdThing: 123,
        },
      },
      required: [],
      additionalProperties: {
        type: "number",
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        bar: {
          title: "bar",
          type: "number",
          anotherWeirdThing: 456,
        },
        new: {
          title: "new",
          type: "array",
          items: {
            type: "boolean",
          },
        },
      },
      required: [],
      additionalProperties: false,
    },
  };

  const actualDescription = await testDefinition.describe(
    {},
    testInputSchema,
    testOutputSchema,
    testContext
  );
  assert.deepEqual(actualContext, expectedContext);
  assert.deepEqual(actualDescription, expectedDescription);
});

test("describe receives defaults with undefined values", async () => {
  let describeRan = false;
  defineNodeType({
    name: "foo",
    inputs: {
      withDefault: { type: "string", default: "DEFAULT1" },
      withoutDefault: { type: "string" },
      "*": { type: "string" },
    },
    outputs: {},
    describe: ({ withDefault, withoutDefault }) => {
      assert.equal(
        // $ExpectType string
        withDefault,
        "DEFAULT1"
      );
      assert.equal(
        // $ExpectType string | undefined
        withoutDefault,
        undefined
      );
      describeRan = true;
      return {
        inputs: [],
      };
    },
    invoke: () => ({}),
  }).describe(undefined, {}, null as never);
  assert.equal(describeRan, true);
});

test("describe receives defaults with overrides", async () => {
  let describeRan = false;
  defineNodeType({
    name: "foo",
    inputs: {
      withDefault: { type: "string", default: "DEFAULT1" },
      withDefaultOverride: { type: "string", default: "DEFAULT2" },
      withoutDefault: { type: "string" },
      withoutDefaultOverride: { type: "string" },
      "*": { type: "string" },
    },
    outputs: {},
    describe: ({
      withDefault,
      withDefaultOverride,
      withoutDefault,
      withoutDefaultOverride,
    }) => {
      assert.equal(
        // $ExpectType string
        withDefault,
        "DEFAULT1"
      );
      assert.equal(
        // $ExpectType string
        withDefaultOverride,
        "OVERRIDE1"
      );
      assert.equal(
        // $ExpectType string | undefined
        withoutDefault,
        undefined
      );
      assert.equal(
        // $ExpectType string | undefined
        withoutDefaultOverride,
        "OVERRIDE2"
      );
      describeRan = true;
      return {
        inputs: [],
      };
    },
    invoke: () => ({}),
  }).describe(
    {
      withDefaultOverride: "OVERRIDE1",
      withoutDefaultOverride: "OVERRIDE2",
    },
    {},
    {},
    null as never
  );
  assert.equal(describeRan, true);
});

test("unsafeSchema can be used to force a raw JSON schema", async () => {
  assert.deepEqual(
    await defineNodeType({
      name: "foo",
      inputs: {
        si1: { type: array("number") },
        "*": { type: "number" },
      },
      outputs: {
        so1: { type: array("string") },
        "*": { type: "number" },
      },
      describe: () => ({
        inputs: unsafeSchema({
          properties: {
            foo: { type: "number" },
            bar: { type: "string" },
          },
          required: ["bar"],
          additionalProperties: true,
        }),
        outputs: unsafeSchema({
          properties: {
            bar: { type: "string" },
          },
        }),
      }),
      invoke: () => ({ so1: ["foo"] }),
    }).describe(),
    {
      inputSchema: {
        type: "object",
        properties: {
          si1: {
            title: "si1",
            type: "array",
            items: { type: "number" },
          },
          foo: {
            type: "number",
          },
          bar: {
            type: "string",
          },
        },
        required: ["si1", "bar"],
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        properties: {
          so1: {
            title: "so1",
            type: "array",
            items: { type: "string" },
          },
          bar: {
            type: "string",
          },
        },
        required: [],
      },
    }
  );
});
