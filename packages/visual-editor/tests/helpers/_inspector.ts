/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { Graph } from "../../src/engine/inspector/graph/graph.js";
import { MutableGraphImpl } from "../../src/engine/inspector/graph/mutable-graph.js";
import { InspectableGraphOptions } from "../../src/engine/index.js";
import { makeTestGraphStore } from "./_graph-store.js";

export { inspector };

function inspector(
  graph: GraphDescriptor,
  options: InspectableGraphOptions = {}
) {
  const store = makeTestGraphStore(options);
  return new Graph("", new MutableGraphImpl(graph, store));
}
