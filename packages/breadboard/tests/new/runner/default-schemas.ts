/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { recipe } from "../../../src/new/recipe-grammar/recipe.js";

import { testKit } from "../../helpers/_test-kit.js";

test("schema derived from reverser (has describe)", async (t) => {
  const graph = recipe<{ foo: string }>(({ foo }) => ({
    bar: testKit.reverser({ foo }).foo,
  }));

  const serialized = await graph.serialize();

  const inputSchema = serialized.nodes.find((node) => node.type === "input")
    ?.configuration?.schema;
  const outputSchema = serialized.nodes.find((node) => node.type === "output")
    ?.configuration?.schema;

  t.deepEqual(inputSchema, {
    type: "object",
    properties: {
      foo: { type: "string", title: "foo", description: "Reverse: foo" },
    },
    required: ["foo"],
  });

  // Note "foo" as title, as this is determined by the reverse node.
  t.deepEqual(outputSchema, {
    type: "object",
    properties: {
      bar: { type: "string", title: "foo", description: "Reversed: foo" },
    },
    required: ["bar"],
  });
});

test("schema derived from noop (no describe)", async (t) => {
  const graph = recipe(({ foo }) => ({
    bar: testKit.noop({ foo }).foo,
  }));

  const serialized = await graph.serialize();

  const inputSchema = serialized.nodes.find((node) => node.type === "input")
    ?.configuration?.schema;
  const outputSchema = serialized.nodes.find((node) => node.type === "output")
    ?.configuration?.schema;

  t.deepEqual(inputSchema, {
    type: "object",
    properties: {
      foo: { type: "string", title: "foo" },
    },
    required: ["foo"],
  });

  t.deepEqual(outputSchema, {
    type: "object",
    properties: {
      bar: { type: "string", title: "bar" },
    },
    required: ["bar"],
  });
});

test("schema derived from noop, with type casts", async (t) => {
  const graph = recipe(({ foo }) => ({
    bar: testKit
      .noop({
        foo: foo.isNumber().title("The foo").description("A foo-lish number"),
      })
      .foo.isNumber()
      .description("A bar-ish number"),
  }));

  const serialized = await graph.serialize();

  const inputSchema = serialized.nodes.find((node) => node.type === "input")
    ?.configuration?.schema;
  const outputSchema = serialized.nodes.find((node) => node.type === "output")
    ?.configuration?.schema;

  t.deepEqual(inputSchema, {
    type: "object",
    properties: {
      foo: {
        type: "number",
        title: "The foo",
        description: "A foo-lish number",
      },
    },
    required: ["foo"],
  });

  t.deepEqual(outputSchema, {
    type: "object",
    properties: {
      bar: { type: "number", title: "bar", description: "A bar-ish number" },
    },
    required: ["bar"],
  });
});

test("schema derived from reverser, with type annotations", async (t) => {
  const graph = recipe<{ foo: string }>(({ foo }) => ({
    bar: testKit
      .reverser({ foo: foo.title("A foo") })
      .foo.description("Reversed bar"),
  }));

  const serialized = await graph.serialize();

  const inputSchema = serialized.nodes.find((node) => node.type === "input")
    ?.configuration?.schema;
  const outputSchema = serialized.nodes.find((node) => node.type === "output")
    ?.configuration?.schema;

  t.deepEqual(inputSchema, {
    type: "object",
    properties: {
      foo: { type: "string", title: "A foo", description: "Reverse: A foo" },
    },
    required: ["foo"],
  });

  // Note "A foo" as title, as this is determined by the reverse node,
  // while description is overriden.
  t.deepEqual(outputSchema, {
    type: "object",
    properties: {
      bar: { type: "string", title: "A foo", description: "Reversed bar" },
    },
    required: ["bar"],
  });
});
