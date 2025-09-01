/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  GraphStoreArgs,
  InspectableGraph,
  InspectableGraphOptions,
  MutableGraphStore,
} from "@breadboard-ai/types";
import { GraphStore, makeTerribleOptions } from "./graph-store.js";
import { Graph } from "./graph/graph.js";
import { MutableGraphImpl } from "./graph/mutable-graph.js";

/**
 *
 * @deprecated Use GraphStore instead.
 */
export const inspect = (
  graph: GraphDescriptor,
  options: InspectableGraphOptions = {}
): InspectableGraph => {
  const store = new GraphStore(makeTerribleOptions(options));
  return new Graph("", new MutableGraphImpl(graph, store));
};

export function createGraphStore(args: GraphStoreArgs): MutableGraphStore {
  return new GraphStore(args);
}
