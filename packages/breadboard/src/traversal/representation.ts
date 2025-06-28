/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphRepresentation } from "@breadboard-ai/types";
import type {
  Edge,
  GraphDescriptor,
  NodeDescriptor,
  NodeIdentifier,
} from "../types.js";

export class GraphRepresentationImpl implements GraphRepresentation {
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

  #notInTails(id: NodeIdentifier) {
    return !this.tails.has(id) || this.tails.get(id)?.length === 0;
  }

  #findEntries(): NodeIdentifier[] {
    const entries = Array.from(this.nodes.keys()).filter((node) =>
      this.#notInHeads(node)
    );
    // If entries is empty, return empty array
    if (entries.length === 0) return [];

    // Now, let's separate out all standalone steps and see if maybe we only
    // have standalone nodes.
    const standalone: NodeIdentifier[] = [];
    const connected: NodeIdentifier[] = [];
    let onlyStandalone = true;
    entries.forEach((node) => {
      if (this.#notInTails(node)) {
        standalone.push(node);
      } else {
        onlyStandalone = false;
        connected.push(node);
      }
    });

    // If there are no standalone nodes, return all entries as usual.
    if (standalone.length === 0) return entries;

    // First, let's see if we can find the starting one
    const start = standalone.find(
      (node) => this.nodes.get(node)!.metadata?.start
    );
    // If there's a standalone start node, let's return.
    if (start) return [start];

    if (onlyStandalone) {
      // This is the situation when we have a bunch of random nodes in graph
      // and they are not connected, and there's no designated start node.

      // Just return the first standalone node.
      return [standalone.at(0)!];
    } else {
      // If there are both standalone and connected nodes, we just ignore
      // all standalone nodes.
      return connected;
    }
  }

  constructor(descriptor: GraphDescriptor, start?: NodeIdentifier) {
    if (start) {
      this.start = start;
    }
    this.tails = descriptor.edges.reduce((acc, edge) => {
      const from = edge.from;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      acc.has(from) ? acc.get(from)?.push(edge) : acc.set(from, [edge]);
      return acc;
    }, new Map());

    this.heads = descriptor.edges.reduce((acc, edge) => {
      const to = edge.to;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
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
