/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "../types.js";
import { inspectableNode } from "./node.js";
import { InspectableGraph, InspectableNode } from "./types.js";

export const inspectableGraph = (graph: GraphDescriptor): InspectableGraph => {
  return new Graph(graph);
};

class Graph implements InspectableGraph {
  #graph: GraphDescriptor;
  #nodes: InspectableNode[];
  #nodeMap: Map<NodeIdentifier, InspectableNode>;
  #typeMap: Map<NodeTypeIdentifier, InspectableNode[]> = new Map();

  constructor(graph: GraphDescriptor) {
    this.#graph = graph;
    this.#nodes = this.#graph.nodes.map((node) => inspectableNode(node, this));
    this.#nodeMap = new Map(
      this.#nodes.map((node) => [node.descriptor.id, node])
    );
    this.#nodes.forEach((node) => {
      const type = node.descriptor.type;
      let list = this.#typeMap.get(type);
      if (!list) {
        list = [];
        this.#typeMap.set(type, list);
      }
      list.push(node);
    });
  }

  nodesByType(type: NodeTypeIdentifier): InspectableNode[] {
    return this.#typeMap.get(type) || [];
  }

  nodeById(id: NodeIdentifier) {
    return this.#nodeMap.get(id);
  }

  nodes(): InspectableNode[] {
    return this.#nodes;
  }

  incomingForNode(id: NodeIdentifier): InspectableNode[] {
    return this.#graph.edges
      .filter((edge) => edge.to === id)
      .map((edge) => this.nodeById(edge.from)!)
      .filter((node) => node !== undefined);
  }

  outgoingForNode(id: NodeIdentifier): InspectableNode[] {
    return this.#graph.edges
      .filter((edge) => edge.from === id)
      .map((edge) => this.nodeById(edge.to)!)
      .filter((node) => node !== undefined);
  }
}
