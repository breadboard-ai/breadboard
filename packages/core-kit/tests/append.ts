/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import append, {
  ObjectType,
  getObjectType,
  computeInputSchema,
} from "../src/nodes/append.js";

test("getObjectType correctly recognizes various object types", (t) => {
  t.is(getObjectType("string"), ObjectType.stringy);
  t.is(getObjectType(["array"]), ObjectType.array);
  t.is(getObjectType({ object: true }), ObjectType.object);
  t.is(getObjectType(1), ObjectType.stringy);
  t.is(getObjectType(1.1), ObjectType.stringy);
  t.is(getObjectType(true), ObjectType.stringy);
  t.is(getObjectType(BigInt(1)), ObjectType.stringy);
  t.is(getObjectType(null), ObjectType.stringy);
  t.is(getObjectType(undefined), ObjectType.stringy);
});

test("`append` correctly recognizes empty accumulator", async (t) => {
  const invoke = append.invoke;
  t.deepEqual(await invoke({ value: "string" }), {
    accumulator: "value: string",
  });
  t.deepEqual(await invoke({ accumulator: null, value: "string" }), {
    accumulator: "value: string",
  });
  t.deepEqual(await invoke({ accumulator: 0, value: "string" }), {
    accumulator: "0\nvalue: string",
  });
  t.deepEqual(await invoke({ accumulator: false, value: "string" }), {
    accumulator: "false\nvalue: string",
  });
  t.deepEqual(await invoke({ accumulator: "", value: "string" }), {
    accumulator: "\nvalue: string",
  });
});

test("`append` correctly appends to various object types", async (t) => {
  const invoke = append.invoke;
  t.deepEqual(await invoke({ accumulator: "string", value: "string" }), {
    accumulator: "string\nvalue: string",
  });
  t.deepEqual(await invoke({ accumulator: "string", foo: "bar", baz: 1 }), {
    accumulator: "string\nfoo: bar\nbaz: 1",
  });
  t.deepEqual(await invoke({ accumulator: [], value: "string" }), {
    accumulator: [{ value: "string" }],
  });
  t.deepEqual(await invoke({ accumulator: ["test"], foo: "bar", baz: 1 }), {
    accumulator: ["test", { foo: "bar", baz: 1 }],
  });
  t.deepEqual(await invoke({ accumulator: {}, value: "string" }), {
    accumulator: { value: "string" },
  });
  t.deepEqual(
    await invoke({ accumulator: { test: true }, foo: "bar", baz: 1 }),
    {
      accumulator: { test: true, foo: "bar", baz: 1 },
    }
  );
});

test("`append` doesn't append when there are no values", async (t) => {
  const invoke = append.invoke;
  t.deepEqual(await invoke({ accumulator: "string" }), {
    accumulator: "string",
  });
  t.deepEqual(await invoke({ accumulator: [] }), {
    accumulator: [],
  });
  t.deepEqual(await invoke({ accumulator: {} }), {
    accumulator: {},
  });
});

test("`append` correctly stringifies non-stringy values", async (t) => {
  const invoke = append.invoke;
  t.deepEqual(await invoke({ accumulator: "string", value: ["string"] }), {
    accumulator: 'string\nvalue: ["string"]',
  });
  t.deepEqual(
    await invoke({ accumulator: "string", value: { key: "string" } }),
    {
      accumulator: 'string\nvalue: {"key":"string"}',
    }
  );
});

test("`computeInputSchema` reacts to incoming wires", (t) => {
  {
    const incomingWires = {};
    const inputSchema = computeInputSchema(incomingWires);
    t.like(inputSchema, {
      properties: {
        accumulator: {
          title: "accumulator",
        },
      },
    });
  }
  {
    const incomingWires = {
      properties: {
        foo: {
          title: "foo",
          type: "string",
        },
      },
    };
    const inputSchema = computeInputSchema(incomingWires);
    t.like(inputSchema, {
      properties: {
        accumulator: {
          title: "accumulator",
        },
        foo: {
          title: "foo",
          type: "string",
        },
      },
    });
  }
});
