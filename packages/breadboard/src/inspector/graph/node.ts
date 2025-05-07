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

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    const describeEntry = this.#graph.describe.get(
      this.descriptor.id,
      this.#graphId,
      inputs
    );
    return describeEntry.latest;
  }

  currentPorts(
    inputValues?: InputValues,
    outputValues?: OutputValues
  ): InspectableNodePorts {
    const snapshot = this.#graph.describe.get(
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
    const described = await this.describe(inputValues);
    return describerResultToPorts(
      this,
      described,
      false,
      inputValues,
      outputValues
    );
  }

  setDeleted() {
    this.#deleted = true;
  }

  deleted() {
    return this.#deleted;
  }
}
