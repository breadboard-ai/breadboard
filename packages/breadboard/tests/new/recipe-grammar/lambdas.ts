/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { recipe, isLambda } from "../../../src/new/recipe-grammar/recipe.js";
import { isValue } from "../../../src/new/recipe-grammar/value.js";
import { Serializeable } from "../../../src/new/runner/types.js";
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
  const graph = recipe(({ foo }) => {
    const lambda = recipe((inputs) => testKit.noop(inputs));
    t.true(isLambda(lambda));
    t.false(isLambda(testKit.noop({})));
    const caller = recipe(({ lambda, foo }) => {
      return lambda.invoke({ foo });
    });
    return caller({ lambda, foo });
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "bar" });
});

test("simplest lambda, direct call, no invoke()", async (t) => {
  const graph = recipe(({ foo }) => {
    const lambda = recipe((inputs) => testKit.noop(inputs));
    t.assert(isLambda(lambda));
    const caller = recipe(({ lambda, foo }) => {
      return lambda({ foo });
    });
    return caller({ lambda, foo });
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "bar" });
});

test("simplest closure lambda, using to()", async (t) => {
  const graph = recipe(({ foo, bar }) => {
    const lambda = recipe((inputs) => testKit.noop(inputs));
    bar.to(lambda);
    const caller = recipe(({ lambda, foo }) => {
      return lambda({ foo });
    });
    return caller({ lambda, foo });
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar", bar: "baz" });
  t.deepEqual(result, { foo: "bar", bar: "baz" });
});

test("simplest closure lambda, using in()", async (t) => {
  const graph = recipe(({ foo, bar }) => {
    const lambda = recipe((inputs) => testKit.noop(inputs));
    t.true(isLambda(lambda.in(bar)));
    const caller = recipe(({ lambda, foo }) => {
      return lambda.invoke({ foo });
    });
    return caller({ lambda, foo });
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar", bar: "baz" });
  t.deepEqual(result, { foo: "bar", bar: "baz" });
});

test("serialize simple lambda", async (t) => {
  // This is no closure, so there should be no lambda node
  const lambda = recipe((inputs) => testKit.noop(inputs));
  t.assert(isLambda(lambda));

  // When wiring it, no lambda node is created
  const boardValue = lambda.getBoardCapabilityAsValue();
  t.false(isValue(boardValue));
  t.like(await boardValue, { kind: "board" });

  // Nor is there one in the serialized graph
  const serialized = await lambda.serialize();
  t.false(serialized?.nodes?.some((node) => node.type === "lambda"));
});

test("serialize closure lambda", async (t) => {
  const lambda = recipe((inputs) => testKit.noop(inputs));
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
  const lambda2 = recipe((inputs) => testKit.noop(inputs));
  const serialized2 = await lambda2.serialize();

  t.deepEqual(
    (
      serialized?.nodes?.find((node) => node.type === "lambda")?.configuration
        ?.board as BreadboardCapability
    )?.board,
    { kits: [], ...serialized2 }
  );
});

test("one level auto-wired closure lambda", async (t) => {
  const graph = recipe(({ foo, bar }) => {
    const lambda = recipe(({ foo }) => testKit.noop({ foo, bar }));
    const caller = recipe(({ lambda, foo }) => {
      return lambda({ foo });
    });
    return caller({ lambda, foo });
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar", bar: "baz" });
  t.deepEqual(result, { foo: "bar", bar: "baz" });
});

test("two level auto-wired closure lambda", async (t) => {
  const graph = recipe(({ foo, bar }) => {
    const lambda = recipe(({ foo }) => {
      const lambda2 = recipe(({ foo }) => testKit.noop({ foo, bar }));
      return lambda2({ foo });
    });
    return lambda({ foo });
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar", bar: "baz" });
  t.deepEqual(result, { foo: "bar", bar: "baz" });
});

test("two level nested calling auto-wired closure lambda", async (t) => {
  const caller = recipe(({ lambda, foo }) => {
    return lambda({ foo });
  });

  const graph = recipe(({ foo, bar }) => {
    const lambda = recipe(({ foo }) => {
      const lambda = recipe(({ foo }) => testKit.noop({ foo, bar }));
      return caller({ lambda, foo });
    });
    return caller({ lambda, foo });
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar", bar: "baz" });
  t.deepEqual(result, { foo: "bar", bar: "baz" });
});
