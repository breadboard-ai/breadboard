/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphIdentifier,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import {
  InspectableEdge,
  InspectableNode,
  InspectableNodeType,
  MutableGraph,
} from "../types.js";
import { graphUrlLike } from "../../utils/graph-url-like.js";
import { createGraphNodeType } from "./kits.js";
import { VirtualNode } from "./virtual-node.js";

export { GraphQueries };

/**
 * Encapsulates common graph operations.
 */
class GraphQueries {
  #cache: MutableGraph;
  #graphId: GraphIdentifier;

  constructor(cache: MutableGraph, graphId: GraphIdentifier) {
    this.#cache = cache;
    this.#graphId = graphId;
  }

  #graph(): GraphDescriptor {
    const graph = this.#cache.graph;
    return this.#graphId ? graph.graphs![this.#graphId]! : graph;
  }

  isEntry(id: NodeIdentifier): boolean {
    return this.incoming(id).length === 0;
  }

  isExit(id: NodeIdentifier): boolean {
    return this.outgoing(id).length === 0;
  }

  incoming(id: NodeIdentifier): InspectableEdge[] {
    return this.#graph()
      .edges.filter((edge) => edge.to === id)
      .map((edge) => this.#cache.edges.getOrCreate(edge, this.#graphId));
  }

  outgoing(id: NodeIdentifier): InspectableEdge[] {
    return this.#graph()
      .edges.filter((edge) => edge.from === id)
      .map((edge) => this.#cache.edges.getOrCreate(edge, this.#graphId));
  }

  entries(): InspectableNode[] {
    return this.#cache.nodes
      .nodes(this.#graphId)
      .filter((node) => node.isEntry());
  }

  nodeById(id: NodeIdentifier) {
    if (this.#graph().virtual) {
      return new VirtualNode({ id });
    }
    return this.#cache.nodes.get(id, this.#graphId);
  }

  typeForNode(id: NodeIdentifier): InspectableNodeType | undefined {
    const node = this.nodeById(id);
    if (!node) {
      return undefined;
    }
    return this.typeById(node.descriptor.type);
  }

  typeById(id: NodeTypeIdentifier): InspectableNodeType | undefined {
    const knownNodeType = this.#cache.kits.getType(id);
    if (knownNodeType) {
      return knownNodeType;
    }
    if (!graphUrlLike(id)) {
      return undefined;
    }
    return createGraphNodeType(id, this.#cache.options);
  }
}
