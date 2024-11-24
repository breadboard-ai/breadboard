/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, GraphIdentifier } from "@breadboard-ai/types";
import {
  InspectableGraph,
  InspectableGraphCache,
  InspectableSubgraphs,
} from "./types.js";

export { GraphCache };

type GraphFactory = (graphId: GraphIdentifier) => InspectableGraph;

class GraphCache implements InspectableGraphCache {
  #factory: GraphFactory;
  #graphs: Map<GraphIdentifier, InspectableGraph> = new Map();

  constructor(factory: GraphFactory) {
    this.#factory = factory;
  }

  rebuild(graph: GraphDescriptor) {
    const subgraphs = graph.graphs;
    if (!subgraphs) return;
    this.#graphs = new Map(
      Object.keys(subgraphs).map((id) => [id, this.#factory(id)])
    );
  }

  get(id: GraphIdentifier): InspectableGraph | undefined {
    return this.#graphs.get(id);
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
