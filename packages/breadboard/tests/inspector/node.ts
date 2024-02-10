/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { inspectableGraph } from "../../src/inspector/index.js";
import { GraphDescriptor } from "../../src/types.js";

test("inspectableNode detects a subgraph", (t) => {
  const graph = {
    nodes: [
      { id: "a", type: "foo" },
      { id: "b", type: "invoke" },
      { id: "c", type: "foo" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
  };
  const inspectable = inspectableGraph(graph);
  t.true(inspectable.nodeById("b")?.containsGraph());
});

test("inspectableNode correctly returns node configuration", (t) => {
  const graph = {
    nodes: [
      {
        id: "a",
        type: "foo",
        configuration: {
          foo: "test",
        },
      },
    ],
    edges: [],
  };
  const inspectable = inspectableGraph(graph);
  t.deepEqual(inspectable.nodeById("a")?.configuration(), { foo: "test" });
});

test("inspectableNode supports undefined subgraphs", async (t) => {
  const graph = {
    nodes: [
      { id: "a", type: "foo" },
      { id: "b", type: "invoke" },
      { id: "c", type: "foo" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
  };
  const inspectable = inspectableGraph(graph);
  const b = inspectable.nodeById("b");
  t.true(b?.containsGraph());
  const subgraph = await b?.subgraph(async () => undefined);
  t.assert(subgraph === undefined);
});

test("inspectableNode supports `graph` subgraphs", async (t) => {
  const graph = {
    nodes: [
      { id: "a", type: "foo" },
      {
        id: "b",
        type: "invoke",
        configuration: {
          graph: {
            nodes: [{ id: "d", type: "bar" }],
            edges: [],
          },
        },
      },
      { id: "c", type: "foo" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
  };
  const inspectable = inspectableGraph(graph);
  const b = inspectable.nodeById("b");
  t.true(b?.containsGraph());
  const subgraph = await b?.subgraph(async (graph) => {
    t.deepEqual(graph, {
      nodes: [{ id: "d", type: "bar" }],
      edges: [],
    });
    return inspectableGraph(graph as GraphDescriptor);
  });
  t.truthy(subgraph);
  t.deepEqual(subgraph?.nodeById("d")?.descriptor.type, "bar");
});

test("inspectableNode supports `path` subgraphs", async (t) => {
  const graph = {
    nodes: [
      { id: "a", type: "foo" },
      {
        id: "b",
        type: "invoke",
        configuration: {
          path: "http://example.com/graphs/foo.json",
        },
      },
      { id: "c", type: "foo" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
  };
  const inspectable = inspectableGraph(graph);
  const b = inspectable.nodeById("b");
  t.true(b?.containsGraph());
  const subgraph = await b?.subgraph(async (path) => {
    t.is(path, "http://example.com/graphs/foo.json");
    return inspectableGraph({
      nodes: [{ id: "d", type: "bar" }],
      edges: [],
    });
  });
  t.truthy(subgraph);
  t.deepEqual(subgraph?.nodeById("d")?.descriptor.type, "bar");
});
