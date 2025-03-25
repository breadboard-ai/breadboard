/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphIdentifier,
  ImportIdentifier,
  ModuleIdentifier,
  NodeIdentifier,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import {
  InspectableEdge,
  InspectableGraph,
  InspectableNode,
  InspectableNodeType,
  MutableGraph,
} from "../types.js";
import { graphUrlLike } from "../../utils/graph-url-like.js";
import { createGraphNodeType } from "./kits.js";
import { VirtualNode } from "./virtual-node.js";
import { Outcome } from "../../data/types.js";
import { err } from "../../data/file-system/utils.js";
import { baseURLFromString, SENTINEL_BASE_URL } from "../../loader/loader.js";
import { getModuleId, isModule } from "../utils.js";

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
    return createGraphNodeType(id, this.#cache);
  }

  moduleExports(): Set<ModuleIdentifier> {
    const exports = this.#cache.graph.exports;
    if (!exports) return new Set();
    return new Set(
      exports.filter((e) => isModule(e)).map((e) => getModuleId(e))
    );
  }

  graphExports(): Set<GraphIdentifier> {
    const exports = this.#cache.graph.exports;
    if (!exports) return new Set();
    return new Set(exports.filter((e) => !isModule(e)).map((e) => e.slice(1)));
  }

  async imports(): Promise<Map<ImportIdentifier, Outcome<InspectableGraph>>> {
    if (this.#graphId || !this.#cache.graph.imports) return new Map();

    const results: Map<ImportIdentifier, Outcome<InspectableGraph>> = new Map();
    const entries = Object.entries(this.#cache.graph.imports);
    for (const [name, value] of entries) {
      let outcome: Outcome<InspectableGraph> = err(
        `Unknown error resolving import "${name}`
      );
      if (!value || !("url" in value)) {
        outcome = err(`Invalid import value "${JSON.stringify(value)}`);
      } else {
        try {
          const url = new URL(
            value.url,
            baseURLFromString(this.#cache.graph.url) || SENTINEL_BASE_URL
          ).href;
          const store = this.#cache.store;
          const adding = store.addByURL(url, [this.#cache.id], {});
          const mutable = await store.getLatest(adding.mutable);
          const inspectable = store.inspect(mutable.id, "");
          if (!inspectable) {
            outcome = err(`Unable to inspect graph at URL "${url}`);
          } else {
            outcome = inspectable;
          }
        } catch (e) {
          outcome = err((e as Error).message);
        } finally {
          results.set(name, outcome);
        }
      }
    }
    return results;
  }
}
