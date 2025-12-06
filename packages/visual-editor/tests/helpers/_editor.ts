/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditableGraph,
  EditableGraphOptions,
  GraphDescriptor,
} from "@breadboard-ai/types";
import { MutableGraphImpl } from "../../src/engine/inspector/graph/mutable-graph.js";
import { Graph } from "../../src/engine/editor/graph.js";
import { makeTestGraphStore } from "./_graph-store.js";

export const editGraph = (
  graph: GraphDescriptor,
  options: EditableGraphOptions = {}
): EditableGraph => {
  const store = makeTestGraphStore(options);
  const mutable = new MutableGraphImpl(graph, store);
  return new Graph(mutable, options);
};
