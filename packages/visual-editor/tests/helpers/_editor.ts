/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditableGraph,
  EditableGraphOptions,
  GraphDescriptor,
  MutableGraphStore,
} from "@breadboard-ai/types";
import { createMutableGraph } from "./_mutable-graph.js";
import { Graph } from "../../src/engine/editor/graph.js";
import { makeTestGraphStore, makeTestGraphStoreArgs } from "./_graph-store.js";

export { editGraphStore };

export const editGraph = (
  graph: GraphDescriptor,
  options: EditableGraphOptions = {}
): EditableGraph => {
  const args = makeTestGraphStoreArgs(options);
  const store = makeTestGraphStore(args);
  const mutable = createMutableGraph(graph, store, args);
  return new Graph(mutable, options);
};

/**
 * Creates an EditableGraph from a GraphStore.
 * Test helper replacing the removed `graphStore.edit()` method.
 */
function editGraphStore(
  graphStore: MutableGraphStore,
  options: EditableGraphOptions = {}
): EditableGraph | undefined {
  const mutable = graphStore.get();
  if (!mutable) return undefined;
  return new Graph(mutable, options);
}
