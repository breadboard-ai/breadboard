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
  start?: NodeIdentifier;
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

  #notInHeads(id: NodeIdentifier) {
    return !this.heads.has(id) || this.heads.get(id)?.length === 0;
  }

  #findEntries() {
    if (this.start) {
      const entry = this.nodes.has(this.start);
      return entry ? [this.start] : [];
    }
    // Otherwise, fall back to computing entries based on edges.
    return Array.from(this.nodes.keys()).filter((node) =>
      this.#notInHeads(node)
    );
  }

  constructor(descriptor: GraphDescriptor, start?: NodeIdentifier) {
    if (start) {
      this.start = start;
    }
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

    this.entries = this.#findEntries();
  }
}
