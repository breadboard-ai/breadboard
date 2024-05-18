/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeIdentifier,
} from "@google-labs/breadboard-schema/graph.js";
import { EditOperation, EditSpec, SingleEditResult } from "../types.js";
import { InspectableGraphWithStore } from "../../inspector/types.js";

export class RemoveNode implements EditOperation {
  #graph: GraphDescriptor;
  #inspector: InspectableGraphWithStore;

  constructor(graph: GraphDescriptor, inspector: InspectableGraphWithStore) {
    this.#graph = graph;
    this.#inspector = inspector;
  }

  async can(id: NodeIdentifier): Promise<SingleEditResult> {
    const exists = !!this.#inspector.nodeById(id);
    if (!exists) {
      return {
        success: false,
        error: `Unable to remove node: node with id "${id}" does not exist`,
      };
    }
    return { success: true };
  }

  async do(spec: EditSpec): Promise<SingleEditResult> {
    if (spec.type !== "removenode") {
      throw new Error(
        `Editor API integrity error: expected type "removenode", received "${spec.type}" instead.`
      );
    }
    const id = spec.id;
    const can = await this.can(id);
    if (!can.success) {
      return can;
    }

    // Remove any edges that are connected to the removed node.
    this.#graph.edges = this.#graph.edges.filter((edge) => {
      const shouldRemove = edge.from === id || edge.to === id;
      if (shouldRemove) {
        this.#inspector.edgeStore.remove(edge);
      }
      return !shouldRemove;
    });
    // Remove the node from the graph.
    this.#graph.nodes = this.#graph.nodes.filter((node) => node.id != id);
    this.#inspector.nodeStore.remove(id);
    return { success: true };
  }
}
