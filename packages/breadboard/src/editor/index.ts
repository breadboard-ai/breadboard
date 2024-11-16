/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";
import { Graph } from "./graph.js";
import { EditableGraph, EditableGraphOptions } from "./types.js";

export const editGraph = (
  graph: GraphDescriptor,
  options: EditableGraphOptions = {}
): EditableGraph => {
  return new Graph(graph, options, "", null);
};

export { blank, blankLLMContent } from "./blank.js";
