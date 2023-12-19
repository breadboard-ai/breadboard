/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import test from "ava";

import { recipe } from "../../../src/new/recipe-grammar/recipe.js";
import { Serializeable } from "../../../src/new/runner/types.js";
import {
  InputValues,
  OutputValues,
  BoardRunner,
  asRuntimeKit,
} from "../../../src/index.js";

import { TestKit, testKit } from "../../helpers/_test-kit.js";

async function serializeAndRunGraph(
  graph: Serializeable,
  inputs: InputValues
): Promise<OutputValues> {
  const board = await BoardRunner.fromGraphDescriptor(await graph.serialize());
  return board.runOnce(inputs, { kits: [asRuntimeKit(TestKit)] });
}

test("simplest graph", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop(inputs);
  });
  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "bar" });
});

test("simplest graph, spread", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop({ ...inputs });
  });
  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "bar" });
});

test("simplest graph, pick input", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop({ foo: inputs.foo });
  });
  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "bar" });
});

test("simplest graph, pick input and output", async (t) => {
  const graph = recipe(async (inputs) => {
    const { foo } = testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.like(result, { foo: "bar" });
});

test("two nodes, spread", async (t) => {
  const graph = recipe<{ [key: string]: string }>(async (inputs) => {
    const reverser = testKit.reverser({ ...inputs });
    return testKit.noop({ ...reverser });
  });
  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "rab" });
});

test("simple inline action", async (t) => {
  const graph = recipe<{ a: number; b: number }, { result: number }>(
    async (inputs) => {
      return recipe<{ a: number; b: number }, { result: number }>(
        async (inputs) => {
          const { a, b } = await inputs;
          return { result: a + b };
        }
      )({ a: inputs.a, b: inputs.b });
    }
  );

  const result = await serializeAndRunGraph(graph, { a: 1, b: 2 });
  t.deepEqual(result, { result: 3 });
});

test("code recipe called from another recipe", async (t) => {
  const add = recipe<{ a: number; b: number }, { result: number }>(
    async (inputs) => {
      const { a, b } = await inputs;
      return { result: a + b };
    }
  );

  const graph = recipe<{ a: number; b: number }, { result: number }>(
    async (inputs) => {
      return add({ a: inputs.a, b: inputs.b });
    }
  );

  const result = await serializeAndRunGraph(graph, { a: 1, b: 2 });
  t.deepEqual(result, { result: 3 });
});

test("nested inline action, with schema", async (t) => {
  const graph = recipe(
    {
      input: z.object({
        a: z.number().describe("A: One Number"),
        b: z.number().describe("B: Another number"),
      }),
      output: z.object({
        result: z.number().describe("Sum: The sum of two numbers"),
      }),
    },
    async (inputs) => {
      return recipe<{ a: number; b: number }, { result: number }>(
        async (inputs) => {
          const { a, b } = await inputs;
          return { result: a + b };
        }
      )({ a: inputs.a, b: inputs.b });
    }
  );

  const result = await serializeAndRunGraph(graph, { a: 1, b: 2 });
  t.deepEqual(result, {
    result: 3,
    schema: {
      type: "object",
      properties: {
        result: {
          type: "number",
          title: "Sum",
          description: "The sum of two numbers",
        },
      },
      required: ["result"],
      additionalProperties: false,
    },
  });
});
