/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriptor,
  Schema,
} from "../types.js";
import {
  InspectableEdge,
  InspectableGraph,
  InspectableGraphLoader,
  InspectableNode,
} from "./types.js";

export const inspectableNode = (
  descriptor: NodeDescriptor,
  inspectableGraph: InspectableGraph
): InspectableNode => {
  return new Node(descriptor, inspectableGraph);
};

class Node implements InspectableNode {
  descriptor: NodeDescriptor;
  #graph: InspectableGraph;
  #incoming: InspectableEdge[] | undefined;
  #outgoing: InspectableEdge[] | undefined;

  constructor(descriptor: NodeDescriptor, graph: InspectableGraph) {
    this.descriptor = descriptor;
    this.#graph = graph;
  }

  incoming(): InspectableEdge[] {
    return (this.#incoming ??= this.#graph.incomingForNode(this.descriptor.id));
  }

  outgoing(): InspectableEdge[] {
    return (this.#outgoing ??= this.#graph.outgoingForNode(this.descriptor.id));
  }

  isEntry(): boolean {
    return this.incoming().length === 0;
  }

  isExit(): boolean {
    return this.outgoing().length === 0;
  }

  isSubgraph(): boolean {
    // This is likely too naive, since map also invokes subgraphs.
    // TODO: Flesh this out some more.
    return this.descriptor.type === "invoke";
  }

  async subgraph(
    loader: InspectableGraphLoader
  ): Promise<InspectableGraph | undefined> {
    if (!this.isSubgraph()) return undefined;

    // Find the subgraph
    type InvokeInputs = { graph: GraphDescriptor; path: string };
    // TODO: Support subgraphs that are dynamically loaded from values.
    const { graph, path } = this.configuration() as InvokeInputs;
    return await loader(graph ? graph : path, this.#graph.raw());
  }

  configuration(): NodeConfiguration {
    return this.descriptor.configuration || {};
  }

  async describe(): Promise<NodeDescriberResult> {
    // The schema of an input or an output is defined by their
    // configuration schema or their incoming/outgoing edges.
    if (this.descriptor.type === "input") {
      return this.#createInputSchema();
    }
    throw new Error("Not yet implemented");
  }

  #createInputSchema(): NodeDescriberResult {
    const schema = this.configuration()?.schema as Schema | undefined;
    if (!schema) {
      const properties: Record<string, Schema> = {};
      this.incoming().forEach((edge) => {
        properties[edge.out] = { type: "string" };
      });
      const required = Object.keys(properties);
      let schema = { type: "object", properties } as Schema;
      if (required.length > 0) {
        schema = { ...schema, required };
      }
      return {
        inputSchema: schema,
        outputSchema: schema,
      };
    }
    return {
      inputSchema: schema,
      outputSchema: schema,
    };
  }
}
