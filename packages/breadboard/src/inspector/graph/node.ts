/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier, NodeMetadata } from "@breadboard-ai/types";
import {
  InputValues,
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriptor,
  OutputValues,
} from "../../types.js";
import { describerResultToPorts } from "./ports.js";
import {
  InspectableEdge,
  InspectableNode,
  InspectableNodePorts,
  InspectableNodeType,
  MutableGraph,
} from "../types.js";
import { GraphQueries } from "./graph-queries.js";
import { DescriberManager } from "./describer-manager.js";

export class Node implements InspectableNode {
  descriptor: NodeDescriptor;
  #graph: MutableGraph;
  #graphId: GraphIdentifier;
  #deleted = false;

  constructor(
    descriptor: NodeDescriptor,
    graph: MutableGraph,
    graphId: GraphIdentifier
  ) {
    this.descriptor = descriptor;
    this.#graph = graph;
    this.#graphId = graphId;
  }

  title(): string {
    return this.descriptor.metadata?.title || this.descriptor.id;
  }

  description(): string {
    return this.descriptor.metadata?.description || this.title();
  }

  incoming(): InspectableEdge[] {
    return new GraphQueries(this.#graph, this.#graphId).incoming(
      this.descriptor.id
    );
  }

  outgoing(): InspectableEdge[] {
    return new GraphQueries(this.#graph, this.#graphId).outgoing(
      this.descriptor.id
    );
  }

  isEntry(): boolean {
    return this.incoming().length === 0;
  }

  isExit(): boolean {
    return this.outgoing().length === 0;
  }

  type(): InspectableNodeType {
    const type = new GraphQueries(this.#graph, this.#graphId).typeForNode(
      this.descriptor.id
    );
    if (!type) {
      throw new Error(
        `Possible integrity error: node ${this.descriptor.id} does not have a type`
      );
    }
    return type;
  }

  configuration(): NodeConfiguration {
    return this.descriptor.configuration || {};
  }

  metadata(): NodeMetadata {
    return this.descriptor.metadata || {};
  }

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    const incoming = this.incoming();
    const outgoing = this.outgoing();
    const manager = DescriberManager.create(this.#graphId, this.#graph);
    if (!manager.success) {
      throw new Error(`Inspect API Integrity Error: ${manager.error}`);
    }
    return manager.result.describeNodeType(
      this.descriptor.id,
      this.descriptor.type,
      {
        inputs: { ...this.configuration(), inputs },
        incoming,
        outgoing,
      }
    );
  }

  async ports(
    inputValues?: InputValues,
    outputValues?: OutputValues
  ): Promise<InspectableNodePorts> {
    const described = await this.describe(inputValues);
    return describerResultToPorts(this, described, inputValues, outputValues);
  }

  setDeleted() {
    this.#deleted = true;
  }

  deleted() {
    return this.#deleted;
  }
}
