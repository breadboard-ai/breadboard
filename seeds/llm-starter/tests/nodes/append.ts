/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import append, { ObjectType, getObjectType } from "../../src/nodes/append.js";

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
  t.deepEqual(await append({ value: "string" }), {
    accumulator: "value: string",
  });
  t.deepEqual(await append({ accumulator: null, value: "string" }), {
    accumulator: "value: string",
  });
  t.deepEqual(await append({ accumulator: 0, value: "string" }), {
    accumulator: "0\nvalue: string",
  });
  t.deepEqual(await append({ accumulator: false, value: "string" }), {
    accumulator: "false\nvalue: string",
  });
  t.deepEqual(await append({ accumulator: "", value: "string" }), {
    accumulator: "\nvalue: string",
  });
});

test("`append` correctly appends to various object types", async (t) => {
  t.deepEqual(await append({ accumulator: "string", value: "string" }), {
    accumulator: "string\nvalue: string",
  });
  t.deepEqual(await append({ accumulator: "string", foo: "bar", baz: 1 }), {
    accumulator: "string\nfoo: bar\nbaz: 1",
  });
  t.deepEqual(await append({ accumulator: [], value: "string" }), {
    accumulator: ["value: string"],
  });
  t.deepEqual(await append({ accumulator: ["test"], foo: "bar", baz: 1 }), {
    accumulator: ["test", "foo: bar", "baz: 1"],
  });
  t.deepEqual(await append({ accumulator: {}, value: "string" }), {
    accumulator: { value: "string" },
  });
  t.deepEqual(
    await append({ accumulator: { test: true }, foo: "bar", baz: 1 }),
    {
      accumulator: { test: true, foo: "bar", baz: 1 },
    }
  );
});

test("`append` doesn't append when there are no values", async (t) => {
  t.deepEqual(await append({ accumulator: "string" }), {
    accumulator: "string",
  });
  t.deepEqual(await append({ accumulator: [] }), {
    accumulator: [],
  });
  t.deepEqual(await append({ accumulator: {} }), {
    accumulator: {},
  });
});

test("`append` correctly stringifies non-stringy values", async (t) => {
  t.deepEqual(await append({ accumulator: "string", value: ["string"] }), {
    accumulator: 'string\nvalue: ["string"]',
  });
  t.deepEqual(
    await append({ accumulator: "string", value: { key: "string" } }),
    {
      accumulator: 'string\nvalue: {"key":"string"}',
    }
  );
});
