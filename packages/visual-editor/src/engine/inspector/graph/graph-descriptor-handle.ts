/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  GraphIdentifier,
  Result,
} from "@breadboard-ai/types";

export { GraphDescriptorHandle };

class GraphDescriptorHandle {
  #graph: GraphDescriptor;
  #url: URL | undefined;

  private constructor(
    graph: GraphDescriptor,
    public readonly graphId: GraphIdentifier
  ) {
    this.#graph = graph;
    this.#url = maybeURL(graph.url);
  }

  url() {
    return this.#url;
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
        error: `Unable to create a valid GraphDescriptorHandle: subgraph "${graphId}" is not in the graph.`,
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
