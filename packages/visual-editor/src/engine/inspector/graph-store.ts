/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  GraphStoreArgs,
  MutableGraph,
  MutableGraphStore,
} from "@breadboard-ai/types";

import { MutableGraphImpl } from "./graph/mutable-graph.js";

export { GraphStore };

class GraphStore implements MutableGraphStore {
  #deps: GraphStoreArgs;
  #mutable: MutableGraph | undefined;

  constructor(args: GraphStoreArgs) {
    this.#deps = args;
  }

  set(graph: GraphDescriptor): void {
    this.#mutable = new MutableGraphImpl(graph, this, this.#deps);
  }

  get(): MutableGraph | undefined {
    return this.#mutable;
  }
}
