/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  GraphDescriptor,
  NodeDescriptor,
  NodeIdentifier,
} from "../types.js";

export class GraphRepresentation {
  /**
   * Tails: a map of all outgoing edges, keyed by node id.
   */
  tails: Map<NodeIdentifier, Edge[]> = new Map();

  /**
   * Heads: a map of all incoming edges, keyed by node id.
   */
  heads: Map<NodeIdentifier, Edge[]> = new Map();

  /**
   * Nodes: a map of all nodes, keyed by node id.
   */
  nodes: Map<NodeIdentifier, NodeDescriptor> = new Map();

  /**
   * Entries: a list of all nodes that have no incoming edges.
   */
  entries: NodeIdentifier[] = [];

  constructor(descriptor: GraphDescriptor) {
    this.tails = descriptor.edges.reduce((acc, edge) => {
      const from = edge.from;
      acc.has(from) ? acc.get(from)?.push(edge) : acc.set(from, [edge]);
      return acc;
    }, new Map());

    this.heads = descriptor.edges.reduce((acc, edge) => {
      const to = edge.to;
      acc.has(to) ? acc.get(to)?.push(edge) : acc.set(to, [edge]);
      return acc;
    }, new Map());

    this.nodes = descriptor.nodes.reduce((acc, node) => {
      acc.set(node.id, node);
      return acc;
    }, new Map());

    this.entries = Array.from(this.tails.keys()).filter(
      (node) => !this.heads.has(node) || this.heads.get(node)?.length === 0
    );
  }
}
