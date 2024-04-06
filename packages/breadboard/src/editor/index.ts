import { GraphDescriptor } from "../types.js";
import { Graph } from "./graph.js";
import { EditableGraph, EditableGraphOptions } from "./types.js";

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export const editGraph = (
  graph: GraphDescriptor,
  options: EditableGraphOptions = {}
): EditableGraph => {
  return new Graph(graph, options);
};
