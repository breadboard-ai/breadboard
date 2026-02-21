/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, InspectableGraphOptions } from "@breadboard-ai/types";
import { Graph } from "../../src/engine/inspector/graph/graph.js";
import { createMutableGraph } from "./_mutable-graph.js";
import { makeTestGraphStore, makeTestGraphStoreArgs } from "./_graph-store.js";

export { inspector };

function inspector(
  graph: GraphDescriptor,
  options: InspectableGraphOptions = {}
) {
  const args = makeTestGraphStoreArgs(options);
  const store = makeTestGraphStore(args);
  return new Graph("", createMutableGraph(graph, store, args));
}
