/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { inspectableGraph } from "../../src/inspector/graph/mutable-graph.js";

test("inspectableGraph nodes, nodeById, and nodesByType work as expected", (t) => {
  const graph = {
    nodes: [
      { id: "a", type: "foo" },
      { id: "b", type: "bar" },
      { id: "c", type: "foo" },
    ],
    edges: [],
  };
  const inspectable = inspectableGraph(graph);
  t.deepEqual(
    inspectable.nodes().map((n) => n.descriptor.id),
    ["a", "b", "c"]
  );
  t.deepEqual(inspectable.nodeById("a")?.descriptor.type, "foo");
  t.deepEqual(inspectable.nodeById("b")?.descriptor.type, "bar");
  t.deepEqual(inspectable.nodeById("c")?.descriptor.type, "foo");

  t.deepEqual(
    inspectable.nodesByType("foo").map((n) => n.descriptor.id),
    ["a", "c"]
  );
});

test("inspectableGraph incomingForNode and outgoingForNode work as expected", (t) => {
  const graph = {
    nodes: [
      { id: "a", type: "foo" },
      { id: "b", type: "bar" },
      { id: "c", type: "foo" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
  };
  const inspectable = inspectableGraph(graph);
  t.deepEqual(
    inspectable.incomingForNode("b").map((e) => e.from.descriptor.id),
    ["a"]
  );
  t.deepEqual(
    inspectable.outgoingForNode("b").map((e) => e.to.descriptor.id),
    ["c"]
  );
  const b = inspectable.nodeById("b");
  t.deepEqual(
    b?.incoming().map((e) => e.from.descriptor.id),
    ["a"]
  );
  t.deepEqual(
    b?.outgoing().map((e) => e.to.descriptor.id),
    ["c"]
  );
  t.deepEqual(inspectable.nodeById("a")?.isEntry(), true);
  t.deepEqual(inspectable.nodeById("c")?.isExit(), true);
  t.deepEqual(b?.isEntry(), false);
  t.deepEqual(b?.isExit(), false);
});

test("Graph correctly returns entry nodes for a graph", (t) => {
  const graph = {
    nodes: [
      { id: "a", type: "foo" },
      { id: "b", type: "bar" },
      { id: "c", type: "foo" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
  };
  const inspectable = inspectableGraph(graph);
  t.deepEqual(
    inspectable.entries().map((n) => n.descriptor.id),
    ["a"]
  );
});
