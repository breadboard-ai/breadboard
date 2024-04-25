/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { defineNodeType } from "../internal/define/define.js";

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
          type: "number",
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
        additionalProperties: false,
      },
    }
  );
});
