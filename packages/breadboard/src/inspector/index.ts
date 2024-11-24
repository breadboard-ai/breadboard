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
import { GraphStore } from "./graph/graph-store.js";
import { inspectableGraph } from "./graph/mutable-graph.js";
import { RunObserver } from "./run/run.js";
import {
  InspectableGraph,
  InspectableGraphOptions,
  InspectableRunObserver,
  RunObserverOptions,
} from "./types.js";

export const inspect = (
  graph: GraphDescriptor,
  options?: InspectableGraphOptions
): InspectableGraph => {
  return inspectableGraph(graph, options);
};

export const createRunObserver = (
  options?: RunObserverOptions
): InspectableRunObserver => {
  const store = new GraphStore();
  return new RunObserver(store, options || {});
};

export { Run } from "./run/run.js";
