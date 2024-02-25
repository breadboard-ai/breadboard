/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { inspectableGraph } from "../../src/inspector/graph.js";

test("InspectableEdge instances are stable for read-only graph", (t) => {
  const graph = inspectableGraph({
    nodes: [
      {
        id: "node0",
        type: "foo",
      },
      {
        id: "node2",
        type: "bar",
      },
    ],
    edges: [{ from: "node0", out: "out", to: "node2", in: "in" }],
  });
  t.true(graph.hasEdge({ from: "node0", out: "out", to: "node2", in: "in" }));
  t.assert(graph.edges()[0] === graph.edges()[0]);

  const edgeInstance1 = graph.edges()[0];

  const node0 = graph.nodeById("node0");
  const edgeInstance2 = node0?.outgoing()[0];

  const node2 = graph.nodeById("node2");
  const edgeInstance3 = node2?.incoming()[0];

  t.assert(edgeInstance1 === edgeInstance2);
  t.assert(edgeInstance2 === edgeInstance3);
});
