/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
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
