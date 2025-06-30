/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphIdentifier,
  InspectableGraph,
  InspectableGraphCache,
  InspectableSubgraphs,
} from "@breadboard-ai/types";

export { GraphCache };

type GraphFactory = (graphId: GraphIdentifier) => InspectableGraph;

class GraphCache implements InspectableGraphCache {
  #factory: GraphFactory;
  #graphs: Map<GraphIdentifier, InspectableGraph> = new Map();

  constructor(factory: GraphFactory) {
    this.#factory = factory;
  }

  rebuild(graph: GraphDescriptor) {
    this.#graphs = new Map(
      Object.keys(graph.graphs || []).map((id) => [id, this.#factory(id)])
    );
    this.#graphs.set("", this.#factory(""));
  }

  get(id: GraphIdentifier): InspectableGraph | undefined {
    return this.#graphs.get(id);
  }

  add(id: GraphIdentifier): void {
    this.#graphs.set(id, this.#factory(id));
  }

  graphs(): InspectableSubgraphs {
    return Object.fromEntries([...this.#graphs.entries()].filter(([id]) => id));
  }

  remove(id: GraphIdentifier): void {
    this.#graphs.delete(id);
  }

  clear(): void {
    this.#graphs.clear();
  }
}
