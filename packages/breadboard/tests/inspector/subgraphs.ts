/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import test from "ava";
import { inspectableGraph } from "../../src/inspector/graph.js";

test("InspectableGraph correctly provides subgraphs", async (t) => {
  const graph: GraphDescriptor = {
    nodes: [],
    edges: [],
    graphs: {
      "#foo": {
        nodes: [{ id: "a", type: "foo" }],
        edges: [],
      },
    },
  };

  const inspectable = inspectableGraph(graph);
  const graphs = inspectable.graphs()!;

  t.is(Object.values(graphs).length, 1);
  const subgraph = graphs["#foo"];
  t.truthy(subgraph);
  t.is(subgraph.graphId(), "#foo");
  const node = subgraph.nodeById("a");
  t.truthy(node);
  t.is(node?.descriptor.type, "foo");
});
