/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";
import { inspectableGraph } from "./graph.js";
import { InspectableGraph, InspectableGraphOptions } from "./types.js";

export const inspect = (
  graph: GraphDescriptor,
  options?: InspectableGraphOptions
): InspectableGraph => {
  return inspectableGraph(graph, options);
};
