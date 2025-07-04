/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { SchemaBuilder, getSchemaType } from "../../src/schema.js";

test("getSchemaType returns the correct type for a value", (t) => {
  t.is(getSchemaType(null), "null");
  t.is(getSchemaType(undefined), "null");
  t.is(getSchemaType(true), "boolean");
  t.is(getSchemaType(false), "boolean");
  t.is(getSchemaType(1), "number");
  t.is(getSchemaType(1.5), "number");
  t.is(getSchemaType("foo"), "string");
  t.is(getSchemaType({}), "object");
  t.is(getSchemaType([]), "array");
});

test("SchemaBuilder can construct an empty schema", (t) => {
  const builder = new SchemaBuilder();
  const schema = builder.build();
  t.deepEqual(schema, {
    type: "object",
    properties: {},
    additionalProperties: false,
  });
});

test("SchemaBuilder can construct a schema from inputs", (t) => {
  {
    const builder = new SchemaBuilder().addInputs({});
    const schema = builder.build();
    t.deepEqual(schema, {
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  }
  {
    const schema = new SchemaBuilder().addInputs().build();
    t.deepEqual(schema, {
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  }
  {
    const builder = new SchemaBuilder();
    builder.addInputs({
      foo: 1,
      bar: "baz",
      qux: true,
      quux: null,
      corge: undefined,
      grault: [],
      garply: {},
    });
    const schema = builder.build();
    t.deepEqual(schema, {
      type: "object",
      properties: {
        foo: { type: "number" },
        bar: { type: "string" },
        qux: { type: "boolean" },
        quux: { type: "null" },
        corge: { type: "null" },
        grault: { type: "array" },
        garply: { type: "object" },
      },
      additionalProperties: false,
    });
  }
});

test("SchemaBuilder can set `additionalProperties`", (t) => {
  {
    const builder = new SchemaBuilder().setAdditionalProperties();
    const schema = builder.build();
    t.deepEqual(schema, {
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  }
  {
    const builder = new SchemaBuilder().setAdditionalProperties(true);
    const schema = builder.build();
    t.deepEqual(schema, {
      type: "object",
      properties: {},
    });
  }
  {
    const builder = new SchemaBuilder().setAdditionalProperties(false);
    const schema = builder.build();
    t.deepEqual(schema, {
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  }
});

test("SchemaBuilder can add a property", (t) => {
  const builder = new SchemaBuilder().addProperty("foo", { type: "string" });
  const schema = builder.build();
  t.deepEqual(schema, {
    type: "object",
    properties: {
      foo: { type: "string" },
    },
    additionalProperties: false,
  });
});

test("SchemaBuilder can add properties", (t) => {
  const builder = new SchemaBuilder().addProperties({
    foo: { type: "string" },
    bar: { type: "number" },
  });
  const schema = builder.build();
  t.deepEqual(schema, {
    type: "object",
    properties: {
      foo: { type: "string" },
      bar: { type: "number" },
    },
    additionalProperties: false,
  });
});

test("SchemaBuilder can add required properties in order", (t) => {
  const schema = new SchemaBuilder()
    .addRequired(["foo"])
    .addRequired("bar")
    .addRequired([])
    .addRequired()
    .addRequired("")
    .build();
  t.deepEqual(schema, {
    type: "object",
    properties: {},
    required: ["bar", "foo"],
    additionalProperties: false,
  });
});

test("SchemaBuilder adds only unique required properties", (t) => {
  const schema = new SchemaBuilder()
    .addRequired(["foo", "bar"])
    .addRequired("foo")
    .addRequired(["bar", "baz"])
    .addRequired("baz")
    .build();
  t.deepEqual(schema, {
    type: "object",
    properties: {},
    required: ["bar", "baz", "foo"],
    additionalProperties: false,
  });
});
