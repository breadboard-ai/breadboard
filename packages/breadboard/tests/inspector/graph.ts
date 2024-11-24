/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { inspectableGraph } from "../../src/inspector/mutable-graph.js";
import { GraphDescriptor } from "@breadboard-ai/types";

test("inspectableGraph correctly reacts to edits", (t) => {
  const graph: GraphDescriptor = {
    nodes: [{ id: "a", type: "foo" }],
    edges: [],
  };
  const inspectable = inspectableGraph(graph);
  t.deepEqual(
    inspectable.nodes().map((n) => n.descriptor.id),
    ["a"]
  );
  const editReceiver = inspectable;
  const edge = { from: "a", to: "b", out: "text", in: "text" };
  editReceiver.nodeStore.add({ id: "b", type: "bar" }, "");
  editReceiver.edgeStore.add(edge, "");
  graph.nodes.push({ id: "b", type: "bar" });
  graph.edges.push(edge);

  t.deepEqual(
    inspectable.nodes().map((n) => n.descriptor.id),
    ["a", "b"]
  );
  t.is(inspectable.nodesByType("bar")?.[0], inspectable.nodeById("b")!);
  t.true(inspectable.hasEdge(edge));
  t.is(inspectable.incomingForNode("b")?.[0].from, inspectable.nodeById("a")!);

  editReceiver.nodeStore.remove("b", "");
  editReceiver.edgeStore.remove(edge, "");
  graph.nodes = graph.nodes.filter((n) => n.id !== "b");
  graph.edges = graph.edges.filter((e) => e !== edge);

  t.deepEqual(
    inspectable.nodes().map((n) => n.descriptor.id),
    ["a"]
  );
  t.false(inspectable.hasEdge(edge));
});
