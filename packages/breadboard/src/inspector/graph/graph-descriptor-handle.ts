/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  isImperativeGraph,
  toDeclarativeGraph,
} from "@breadboard-ai/runtime/legacy.js";
import type {
  GraphDescriptor,
  GraphIdentifier,
  ModuleIdentifier,
  Result,
} from "@breadboard-ai/types";

export { GraphDescriptorHandle };

class GraphDescriptorHandle {
  #graph: GraphDescriptor;
  #imperativeMain: ModuleIdentifier | undefined;
  #url: URL | undefined;

  private constructor(
    graph: GraphDescriptor,
    public readonly graphId: GraphIdentifier
  ) {
    if (isImperativeGraph(graph)) {
      const { main } = graph;
      graph = toDeclarativeGraph(graph);
      this.#imperativeMain = main;
    }
    this.#graph = graph;
    this.#url = maybeURL(graph.url);
  }

  main() {
    return this.#imperativeMain;
  }

  url() {
    return this.#url;
  }

  outerGraph() {
    return this.#graph;
  }

  graph() {
    return this.graphId ? this.#graph.graphs![this.graphId]! : this.#graph;
  }

  static create(
    graph: GraphDescriptor,
    graphId: GraphIdentifier
  ): Result<GraphDescriptorHandle> {
    if (graphId && !graph.graphs?.[graphId]) {
      return {
        success: false,
        error: `Unable to create a valid GraphDEscriptorHandle: subgraph "${graphId}" is not in the graph.`,
      };
    }
    return { success: true, result: new GraphDescriptorHandle(graph, graphId) };
  }
}

function maybeURL(url?: string): URL | undefined {
  url = url || "";
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}
