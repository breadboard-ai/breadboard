/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
  t.deepEqual(result, { foo: "bar" });
});

test("two nodes, spread", async (t) => {
  const graph = recipe<{ [key: string]: string }>(async (inputs) => {
    const reverser = testKit.reverser({ ...inputs });
    return testKit.noop({ ...reverser });
  });
  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "rab" });
});
