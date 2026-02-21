/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  GraphStoreArgs,
  InspectableGraphOptions,
  MutableGraph,
  MutableGraphStore,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import { createMutableGraph } from "./_mutable-graph.js";

export { makeTestGraphStore, makeTestGraphStoreArgs, loadGraphIntoStore };

function makeTestGraphStoreArgs(
  options: InspectableGraphOptions = {}
): GraphStoreArgs {
  return {
    sandbox: options.sandbox || {},
    loader: options.loader || {
      load() {
        throw new Error("Do not load graphs with test graph store");
      },
    },
    flags: {
      env: () => {
        throw new Error("Do not use flags with test graph store");
      },
      overrides: () => {
        throw new Error("Do not use flags with test graph store");
      },
      flags: () => {
        throw new Error("Do not use flags with test graph store");
      },
      override() {
        throw new Error("Do not use flags with test graph store");
      },
      clearOverride() {
        throw new Error("Do not use flags with test graph store");
      },
    } satisfies RuntimeFlagManager,
  };
}

/**
 * Creates a MutableGraph from a descriptor and stores it in the given store.
 * Convenience function for tests that need to populate a MutableGraphStore.
 */
function loadGraphIntoStore(
  store: MutableGraphStore,
  graph: GraphDescriptor,
  args?: GraphStoreArgs
): void {
  const storeArgs = args ?? makeTestGraphStoreArgs();
  const mutable = createMutableGraph(graph, store, storeArgs);
  store.set(mutable);
}

/**
 * Creates a test MutableGraphStore for use in unit tests.
 * This replaces the deleted GraphStore class with a minimal implementation.
 */
function makeTestGraphStore(
  args?: GraphStoreArgs
): MutableGraphStore & { _args: GraphStoreArgs } {
  const storeArgs = args ?? makeTestGraphStoreArgs();
  let mutableGraph: MutableGraph | undefined;
  const store = {
    _args: storeArgs,
    set(graph: MutableGraph): void {
      mutableGraph = graph;
    },
    get(): MutableGraph | undefined {
      return mutableGraph;
    },
  };
  return store;
}
