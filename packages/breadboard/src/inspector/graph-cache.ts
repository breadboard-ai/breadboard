/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier } from "@breadboard-ai/types";
import {
  InspectableGraph,
  InspectableGraphCache,
  InspectableSubgraphs,
  MutableGraph,
} from "./types.js";

export { GraphCache };

type GraphFactory = (graphId: GraphIdentifier) => InspectableGraph;

class GraphCache implements InspectableGraphCache {
  #factory: GraphFactory;
  #graphs: Map<GraphIdentifier, InspectableGraph> = new Map();

  constructor(factory: GraphFactory) {
    this.#factory = factory;
  }

  populate(cache: MutableGraph) {
    const subgraphs = cache.graph.graphs;
    if (!subgraphs) return;
    Object.keys(subgraphs).forEach((id) => {
      this.add(id, this.#factory(id));
    });
  }

  add(id: GraphIdentifier, graph: InspectableGraph): void {
    this.#graphs.set(id, graph);
  }

  graphs(): InspectableSubgraphs {
    return Object.fromEntries(this.#graphs.entries());
  }

  remove(id: GraphIdentifier): void {
    this.#graphs.delete(id);
  }

  clear(): void {
    this.#graphs.clear();
  }
}
