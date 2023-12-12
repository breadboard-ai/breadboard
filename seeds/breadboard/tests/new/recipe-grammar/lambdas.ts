/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { recipe, isLambda } from "../../../src/new/recipe-grammar/recipe.js";
import { isValue } from "../../../src/new/recipe-grammar/value.js";
import { Serializeable } from "../../../src/new/runner/types.js";
import { Lambda } from "../../../src/new/recipe-grammar/types.js";
import {
  InputValues,
  OutputValues,
  BoardRunner,
  asRuntimeKit,
  BreadboardCapability,
} from "../../../src/index.js";

import { TestKit, testKit } from "../../helpers/_test-kit.js";

async function serializeAndRunGraph(
  graph: Serializeable,
  inputs: InputValues
): Promise<OutputValues> {
  const board = await BoardRunner.fromGraphDescriptor(await graph.serialize());
  return board.runOnce(inputs, { kits: [asRuntimeKit(TestKit)] });
}

test("simplest lambda", async (t) => {
  const graph = recipe<{ foo: string }>(async (inputs) => {
    const lambda = recipe(async (inputs) => testKit.noop(inputs));
    t.assert(isLambda(lambda));
    const caller = recipe<{ lambda: Lambda; foo: string }>(async (inputs) => {
      return inputs.lambda.invoke({ foo: inputs.foo });
    });
    return caller({ lambda, foo: inputs.foo });
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "bar" });
});

test("simplest closure lambda, using to()", async (t) => {
  const graph = recipe<{ foo: string }>(async (inputs) => {
    const lambda = recipe(async (inputs) => testKit.noop(inputs));
    inputs.bar.to(lambda);
    const caller = recipe<{ lambda: Lambda; foo: string }>(async (inputs) => {
      return inputs.lambda.invoke({ foo: inputs.foo });
    });
    return caller({ lambda, foo: inputs.foo });
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar", bar: "baz" });
  t.deepEqual(result, { foo: "bar", bar: "baz" });
});

test("simplest closure lambda, using in()", async (t) => {
  const graph = recipe<{ foo: string }>(async (inputs) => {
    const lambda = recipe(async (inputs) => testKit.noop(inputs));
    lambda.in(inputs.bar);
    const caller = recipe<{ lambda: Lambda; foo: string }>(async (inputs) => {
      return inputs.lambda.invoke({ foo: inputs.foo });
    });
    return caller({ lambda, foo: inputs.foo });
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar", bar: "baz" });
  t.deepEqual(result, { foo: "bar", bar: "baz" });
});

test("serialize simple lambda", async (t) => {
  const lambda = recipe(async (inputs) => testKit.noop(inputs));
  t.assert(isLambda(lambda));

  // This turns a simple recipe into a lambda
  const boardValue = lambda.getBoardCapabilityAsValue();
  t.assert(isValue(boardValue));

  const serialized = await lambda.serialize();

  // Create another simple one to compare. This time don't use as value.
  const lambda2 = recipe(async (inputs) => testKit.noop(inputs));
  const serialized2 = await lambda2.serialize();

  t.deepEqual(serialized, serialized2);
});

test("serialize closure lambda", async (t) => {
  const lambda = recipe(async (inputs) => testKit.noop(inputs));
  t.assert(isLambda(lambda));

  // Wiring something into the lambda makes it a closure
  testKit.noop({ bar: "baz", $id: "extra-noop" }).to(lambda);

  // This should serialize the graph that generates the lambda, including the
  // nodes generating the incoming data, the lambda node with the graph and an
  // invoke node.
  const serialized = await lambda.serialize();

  t.assert(serialized?.nodes?.some((node) => node.id === "extra-noop"));
  t.assert(serialized?.nodes?.some((node) => node.type === "lambda"));

  // Create another simple one to compare with the inner graph.
  const lambda2 = recipe(async (inputs) => testKit.noop(inputs));
  const serialized2 = await lambda2.serialize();

  t.deepEqual(
    (
      serialized?.nodes?.find((node) => node.type === "lambda")?.configuration
        ?.board as BreadboardCapability
    )?.board,
    { kits: [], ...serialized2 }
  );
});
