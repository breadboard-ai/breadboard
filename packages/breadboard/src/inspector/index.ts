/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeDescriptor,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "../types.js";

type InspectableNode = {
  descriptor: NodeDescriptor;
};

const inspectableNode = (descriptor: NodeDescriptor): InspectableNode => ({
  descriptor,
});

export class Inspector {
  #graph: GraphDescriptor;
  #nodes: InspectableNode[];
  #nodeMap: Map<NodeIdentifier, InspectableNode>;
  #typeMap: Map<NodeTypeIdentifier, InspectableNode[]> = new Map();

  constructor(graph: GraphDescriptor) {
    this.#graph = graph;
    this.#nodes = this.#graph.nodes.map((node) => inspectableNode(node));
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

  nodeById(id: NodeIdentifier) {
    return this.#nodeMap.get(id);
  }

  nodes(): InspectableNode[] {
    return this.#nodes;
  }
}
