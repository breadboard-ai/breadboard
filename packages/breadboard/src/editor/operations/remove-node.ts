/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeIdentifier } from "@google-labs/breadboard-schema/graph.js";
import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "../types.js";
import { InspectableGraph } from "../../inspector/types.js";

export class RemoveNode implements EditOperation {
  async can(
    id: NodeIdentifier,
    inspector: InspectableGraph
  ): Promise<SingleEditResult> {
    const exists = !!inspector.nodeById(id);
    if (!exists) {
      return {
        success: false,
        error: `Unable to remove node: node with id "${id}" does not exist`,
      };
    }
    return { success: true };
  }

  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "removenode") {
      throw new Error(
        `Editor API integrity error: expected type "removenode", received "${spec.type}" instead.`
      );
    }
    const id = spec.id;
    const { graph, inspector, store } = context;
    const can = await this.can(id, inspector);
    if (!can.success) {
      return can;
    }

    // Remove any edges that are connected to the removed node.
    graph.edges = graph.edges.filter((edge) => {
      const shouldRemove = edge.from === id || edge.to === id;
      if (shouldRemove) {
        store.edgeStore.remove(edge);
      }
      return !shouldRemove;
    });
    // Remove the node from the graph.
    graph.nodes = graph.nodes.filter((node) => node.id != id);
    store.nodeStore.remove(id);
    return { success: true };
  }
}
