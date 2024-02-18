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
} from "../types.js";
import { collectPorts } from "./ports.js";
import { EdgeType } from "./schemas.js";
import {
  InspectableEdge,
  InspectableGraph,
  InspectableNode,
  InspectableNodePorts,
  InspectablePortList,
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

  title(): string {
    return this.descriptor.metadata?.title || this.descriptor.id;
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

  configuration(): NodeConfiguration {
    return this.descriptor.configuration || {};
  }

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    return this.#graph.describeType(this.descriptor.type, {
      inputs: { ...inputs, ...this.configuration() },
      incoming: this.incoming(),
      outgoing: this.outgoing(),
    });
  }

  async ports(inputValues?: InputValues): Promise<InspectableNodePorts> {
    const described = await this.describe(inputValues);
    const inputs: InspectablePortList = {
      fixed: described.inputSchema.additionalProperties === false,
      ports: collectPorts(
        EdgeType.In,
        this.incoming(),
        described.inputSchema,
        this.configuration()
      ),
    };
    const outputs: InspectablePortList = {
      fixed: described.outputSchema.additionalProperties === false,
      ports: collectPorts(
        EdgeType.Out,
        this.outgoing(),
        described.outputSchema
      ),
    };
    return { inputs, outputs };
  }
}
