/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { blank, GraphDescriptor, InspectableGraph } from "../../src/index.js";
import { Graph } from "../../src/inspector/graph/graph.js";
import { MutableGraphImpl } from "../../src/inspector/graph/mutable-graph.js";
import { makeTestGraphStore } from "../helpers/_graph-store.js";

const inspect = (graph: GraphDescriptor): InspectableGraph => {
  const store = makeTestGraphStore();
  return new Graph("", new MutableGraphImpl(graph, store));
};

test("importBlank creates a nice blank board", async (t) => {
  const b = blank();
  t.truthy(b);

  // Let's inspect it!

  const inspectable = inspect(b);

  const input = inspectable.nodeById("input");
  t.truthy(input);

  const outgoing = input?.outgoing();
  t.is(outgoing?.length, 1);

  const wire = outgoing?.[0];
  const output = wire?.to;
  t.truthy(output);

  t.is(output?.title(), "output");
});
