/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphIdentifier,
  InputValues,
  InspectableEdge,
  InspectableNode,
  InspectableNodePorts,
  InspectableNodeType,
  MutableGraph,
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriptor,
  NodeIdentifier,
  NodeMetadata,
  OutputValues,
} from "@breadboard-ai/types";
import { GraphQueries } from "./graph-queries.js";
import { describerResultToPorts } from "./ports.js";

export class Node implements InspectableNode {
  descriptor: NodeDescriptor;
  #graph: MutableGraph;
  #graphId: GraphIdentifier;

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

  isStart(): boolean {
    return new GraphQueries(this.#graph, this.#graphId).isStart(
      this.descriptor.id
    );
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

  async describe(): Promise<NodeDescriberResult> {
    const describeEntry = this.#graph.describeNode(
      this.descriptor.id,
      this.#graphId
    );
    return describeEntry.latest;
  }

  currentDescribe(): NodeDescriberResult {
    const describeEntry = this.#graph.describeNode(
      this.descriptor.id,
      this.#graphId
    );
    return describeEntry.current;
  }

  currentPorts(
    inputValues?: InputValues,
    outputValues?: OutputValues
  ): InspectableNodePorts {
    const snapshot = this.#graph.describeNode(
      this.descriptor.id,
      this.#graphId
    );
    return describerResultToPorts(
      this,
      snapshot.current,
      snapshot.updating,
      inputValues,
      outputValues
    );
  }

  async ports(
    inputValues?: InputValues,
    outputValues?: OutputValues
  ): Promise<InspectableNodePorts> {
    const described = await this.describe();
    return describerResultToPorts(
      this,
      described,
      false,
      inputValues,
      outputValues
    );
  }

  routes(): NodeIdentifier[] {
    return new GraphQueries(this.#graph, this.#graphId).routes(
      this.descriptor.id
    );
  }
}
