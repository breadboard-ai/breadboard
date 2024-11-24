/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { inspectableGraph } from "../../src/inspector/mutable-graph.js";

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

test("inspectableNode correctly returns node title", (t) => {
  {
    const graph = {
      nodes: [
        {
          id: "a",
          type: "foo",
        },
      ],
      edges: [],
    };
    const inspectable = inspectableGraph(graph);
    t.deepEqual(inspectable.nodeById("a")?.title(), "a");
  }
  {
    const graph = {
      nodes: [
        {
          id: "a",
          type: "foo",
          metadata: {
            title: "test",
          },
        },
      ],
      edges: [],
    };
    const inspectable = inspectableGraph(graph);
    t.deepEqual(inspectable.nodeById("a")?.title(), "test");
  }
});

test("InspectableNode instances are stable within InspectableGraph", (t) => {
  const graph = {
    nodes: [
      {
        id: "a",
        type: "foo",
      },
      {
        id: "b",
        type: "bar",
      },
    ],
    edges: [{ from: "a", to: "b" }],
  };
  const inspectable = inspectableGraph(graph);
  t.assert(inspectable.nodeById("a") === inspectable.nodeById("a"));
  t.assert(inspectable.nodeById("b") === inspectable.nodeById("b"));
  t.assert(inspectable.nodeById("a") === inspectable.entries()[0]);
  t.assert(inspectable.nodesByType("foo")[0] === inspectable.nodeById("a"));
});

test("A graph with no nodes doesn't cause errors", (t) => {
  const graph = {
    nodes: [],
    edges: [],
  };
  const inspectable = inspectableGraph(graph);
  t.deepEqual(inspectable.nodes(), []);
  t.deepEqual(inspectable.nodeById("a"), undefined);
  t.deepEqual(inspectable.nodesByType("foo"), []);
});
