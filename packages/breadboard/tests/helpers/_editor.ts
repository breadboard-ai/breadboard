/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import {
  EditableGraph,
  EditableGraphOptions,
  GraphStore,
} from "../../src/index.js";
import { MutableGraphImpl } from "../../src/inspector/graph/mutable-graph.js";
import { Graph } from "../../src/editor/graph.js";
import { makeTerribleOptions } from "../../src/inspector/graph-store.js";

export const editGraph = (
  graph: GraphDescriptor,
  options: EditableGraphOptions = {}
): EditableGraph => {
  const store = new GraphStore(makeTerribleOptions(options));
  const mutable = new MutableGraphImpl(graph, store, options);
  return new Graph(mutable, options);
};
