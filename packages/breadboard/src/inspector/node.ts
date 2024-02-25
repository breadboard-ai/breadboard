/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriptor,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "../types.js";
import { collectPorts } from "./ports.js";
import { EdgeType } from "./schemas.js";
import {
  InspectableEdge,
  InspectableGraph,
  InspectableNode,
  InspectableNodePorts,
  InspectablePortList,
  NodeTypeDescriberOptions,
} from "./types.js";

export const inspectableNode = (
  descriptor: NodeDescriptor,
  inspectableGraph: InspectableGraph
): InspectableNode => {
  return new Node(descriptor, inspectableGraph);
};

class Node implements InspectableNode {
  // addNode: no change
  // removeNode: no change
  // addEdge: no change
  // removeEdge: no change
  // changeConfiguration: update value
  // changeMetadata: update value
  descriptor: NodeDescriptor;
  #graph: InspectableGraph;

  constructor(descriptor: NodeDescriptor, graph: InspectableGraph) {
    this.descriptor = descriptor;
    this.#graph = graph;
  }

  title(): string {
    return this.descriptor.metadata?.title || this.descriptor.id;
  }

  incoming(): InspectableEdge[] {
    return this.#graph.incomingForNode(this.descriptor.id);
  }

  outgoing(): InspectableEdge[] {
    return this.#graph.outgoingForNode(this.descriptor.id);
  }

  isEntry(): boolean {
    return this.incoming().length === 0;
  }

  isExit(): boolean {
    return this.outgoing().length === 0;
  }

  configuration(): NodeConfiguration {
    return this.descriptor.configuration || {};
  }

  async #describeInternal(
    options: NodeTypeDescriberOptions
  ): Promise<NodeDescriberResult> {
    return this.#graph.describeType(this.descriptor.type, options);
  }

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    return this.#describeInternal({
      inputs: { ...inputs, ...this.configuration() },
      incoming: this.incoming(),
      outgoing: this.outgoing(),
    });
  }

  async ports(inputValues?: InputValues): Promise<InspectableNodePorts> {
    const incoming = this.incoming();
    const outgoing = this.outgoing();
    const described = await this.#describeInternal({
      inputs: inputValues,
      incoming,
      outgoing,
    });
    const inputs: InspectablePortList = {
      fixed: described.inputSchema.additionalProperties === false,
      ports: collectPorts(
        EdgeType.In,
        incoming,
        described.inputSchema,
        this.configuration()
      ),
    };
    const outputs: InspectablePortList = {
      fixed: described.outputSchema.additionalProperties === false,
      ports: collectPorts(EdgeType.Out, outgoing, described.outputSchema),
    };
    return { inputs, outputs };
  }
}

export class InspectableNodeCache {
  #graph: InspectableGraph;

  // addNode: reset to undefined
  // removeNode: reset to undefined
  // addEdge: no change
  // removeEdge: no change
  // changeConfiguration: no change
  // changeMetadata: no change
  #map?: Map<NodeIdentifier, InspectableNode>;

  // addNode: reset to undefined
  // removeNode: reset to undefined
  // addEdge: no change
  // removeEdge: no change
  // changeConfiguration: no change
  // changeMetadata: no change
  #typeMap?: Map<NodeTypeIdentifier, InspectableNode[]>;

  constructor(graph: InspectableGraph) {
    this.#graph = graph;
  }

  #ensureNodeMap() {
    if (this.#map) return this.#map;
    const typeMap = new Map<NodeTypeIdentifier, InspectableNode[]>();
    const map = new Map(
      this.#graph.raw().nodes.map((node) => {
        const inspectableNode = new Node(node, this.#graph);
        const type = node.type;
        let list = typeMap.get(type);
        if (!list) {
          list = [];
          typeMap.set(type, list);
        }
        list.push(inspectableNode);
        return [node.id, inspectableNode];
      })
    );
    this.#typeMap = typeMap;
    return (this.#map = map);
  }

  byType(type: NodeTypeIdentifier): InspectableNode[] {
    this.#ensureNodeMap();
    return this.#typeMap?.get(type) || [];
  }

  get(id: string): InspectableNode | undefined {
    return this.#ensureNodeMap().get(id);
  }

  nodes(): InspectableNode[] {
    return Array.from(this.#ensureNodeMap().values());
  }
}
