/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { Graph } from "../../src/inspector/graph/graph.js";
import { MutableGraphImpl } from "../../src/inspector/graph/mutable-graph.js";
import { InspectableGraphOptions } from "../../src/index.js";

export { inspector };

function inspector(graph: GraphDescriptor, options?: InspectableGraphOptions) {
  return new Graph("", new MutableGraphImpl(graph, options || {}));
}
