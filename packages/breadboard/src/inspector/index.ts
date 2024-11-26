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
import { inspectableGraph } from "./graph/mutable-graph.js";
import { RunObserver } from "./run/run.js";
import {
  InspectableGraph,
  InspectableGraphOptions,
  InspectableRunObserver,
  MutableGraphStore,
  RunObserverOptions,
} from "./types.js";

export const inspect = (
  graph: GraphDescriptor,
  options?: InspectableGraphOptions
): InspectableGraph => {
  return inspectableGraph(graph, options);
};

export const createRunObserver = (
  store: MutableGraphStore,
  options?: RunObserverOptions
): InspectableRunObserver => {
  return new RunObserver(store, options || {});
};

export { Run } from "./run/run.js";
