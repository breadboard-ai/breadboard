/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MutableGraphImpl } from "../inspector/graph/mutable-graph.js";
import { GraphDescriptor } from "../types.js";
import { Graph } from "./graph.js";
import { EditableGraph, EditableGraphOptions } from "./types.js";

export const editGraph = (
  graph: GraphDescriptor,
  options: EditableGraphOptions = {}
): EditableGraph => {
  const mutable = new MutableGraphImpl(graph, options);
  return new Graph(mutable, options);
};

export { blank, blankLLMContent } from "./blank.js";
