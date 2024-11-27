/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { Graph } from "../../src/inspector/graph/graph.js";
import { MutableGraphImpl } from "../../src/inspector/graph/mutable-graph.js";
import { GraphStore, InspectableGraphOptions } from "../../src/index.js";

export { inspector };

function inspector(
  graph: GraphDescriptor,
  options: InspectableGraphOptions = {}
) {
  const store = new GraphStore(options);
  return new Graph("", new MutableGraphImpl(graph, store, options));
}
