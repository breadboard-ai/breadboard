/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  createDefaultRunStore,
  createDefaultDataStore,
} from "../data/index.js";
import { GraphDescriptor } from "../types.js";
import { GraphStore, makeTerribleOptions } from "./graph-store.js";
import { Graph } from "./graph/graph.js";
import { MutableGraphImpl } from "./graph/mutable-graph.js";
import { RunObserver } from "./run/run.js";
import {
  GraphStoreArgs,
  InspectableGraph,
  InspectableGraphOptions,
  InspectableRunObserver,
  MutableGraphStore,
  RunObserverOptions,
} from "./types.js";

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

export { Run } from "./run/run.js";

export function createGraphStore(args: GraphStoreArgs): MutableGraphStore {
  return new GraphStore(args);
}
