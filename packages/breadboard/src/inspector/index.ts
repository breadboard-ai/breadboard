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

export type InspectableNode = {
  /**
   * The `NodeDescriptor` for the node.
   */
  descriptor: NodeDescriptor;
  /**
   * Returns the nodes that have an edge to this node.
   */
  incoming(): InspectableNode[];
  /**
   * Returns the nodes that have an edge from this node.
   */
  outgoing(): InspectableNode[];
  /**
   * Return true if the node is an entry node (no incoming edges)
   */
  isEntry(): boolean;
  /**
   * Return true if the node is an exit node (no outgoing edges)
   */
  isExit(): boolean;
};

export type InspectableGraph = {
  /**
   * Returns the node with the given id, or undefined if no such node exists.
   * @param id id of the node to find
   */
  nodeById(id: NodeIdentifier): InspectableNode | undefined;
  /**
   * Returns all nodes in the graph.
   */
  nodes(): InspectableNode[];
  /**
   * Returns all nodes of the given type.
   * @param type type of the nodes to find
   */
  nodesByType(type: NodeTypeIdentifier): InspectableNode[];
  /**
   * Returns the nodes that have an edge to the node with the given id.
   * @param id id of the node to find incoming nodes for
   */
  incomingForNode(id: NodeIdentifier): InspectableNode[];
  /**
   * Returns the nodes that have an edge from the node with the given id.
   * @param id id of the node to find outgoing nodes for
   */
  outgoingForNode(id: NodeIdentifier): InspectableNode[];
};

export const inspectableGraph = (graph: GraphDescriptor): InspectableGraph => {
  return new Graph(graph);
};

export const getGraphAPI = (inspectableGraph: InspectableGraph) => {
  const inputs = inspectableGraph.nodesByType("input");
  const outputs = inspectableGraph.nodesByType("output");
  return {
    inputs,
    outputs,
  };
};

const inspectableNode = (
  descriptor: NodeDescriptor,
  inspectableGraph: InspectableGraph
): InspectableNode => {
  return new Node(descriptor, inspectableGraph);
};

class Node implements InspectableNode {
  descriptor: NodeDescriptor;
  #graph: InspectableGraph;
  #incoming: InspectableNode[] | undefined;
  #outgoing: InspectableNode[] | undefined;

  constructor(descriptor: NodeDescriptor, graph: InspectableGraph) {
    this.descriptor = descriptor;
    this.#graph = graph;
  }

  incoming(): InspectableNode[] {
    return (this.#incoming ??= this.#graph.incomingForNode(this.descriptor.id));
  }

  outgoing(): InspectableNode[] {
    return (this.#outgoing ??= this.#graph.outgoingForNode(this.descriptor.id));
  }

  isEntry(): boolean {
    return this.incoming().length === 0;
  }

  isExit(): boolean {
    return this.outgoing().length === 0;
  }
}

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
