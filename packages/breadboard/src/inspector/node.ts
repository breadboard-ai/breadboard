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
} from "../types.js";
import { inspectableGraph } from "./graph.js";
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
    loader?: InspectableGraphLoader
  ): Promise<InspectableGraph | undefined> {
    if (!this.isSubgraph()) return undefined;

    // Find the subgraph
    type InvokeInputs = { graph: GraphDescriptor; path: string };
    const { graph, path } = this.configuration() as InvokeInputs;
    const base = this.#graph.baseURL();
    if (graph) {
      return inspectableGraph(graph, { baseURL: base });
    }

    // TODO: Support subgraphs that are dynamically loaded from values.
    if (!path) return undefined;

    if (!loader) return undefined;
    return await loader(path, this.#graph.raw());
    // // TODO: Don't use `raw()` here.
    // const graphs = this.#graph.raw().graphs;
    // // This logic is lifted from `BoardRunner.load`.
    // // TODO: Deduplicate.
    // const loader = new BoardLoader({ base, graphs });
    // const { graph } = await loader.load(path);
    // return inspectableGraph(graph, { baseURL: new URL(path, base) });
  }

  configuration(): NodeConfiguration {
    return this.descriptor.configuration || {};
  }

  async describe(): Promise<NodeDescriberResult> {
    throw new Error("Not yet implemented");
  }
}
