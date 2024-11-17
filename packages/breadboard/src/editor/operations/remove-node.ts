/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeIdentifier } from "@breadboard-ai/types";
import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "../types.js";
import { InspectableGraph } from "../../inspector/types.js";
import { toSubgraphContext } from "../subgraph-context.js";

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
    return {
      success: true,
      affectedNodes: [id],
      affectedModules: [],
      affectedGraphs: [],
    };
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
    const { id, graphId } = spec;
    const subgraphContext = toSubgraphContext(context, graphId);
    if (!subgraphContext.success) {
      return subgraphContext;
    }
    const { graph, inspector, store } = subgraphContext.result;
    const can = await this.can(id, inspector);
    if (!can.success) {
      return can;
    }

    // Remove any edges that are connected to the removed node.
    graph.edges = graph.edges.filter((edge) => {
      const shouldRemove = edge.from === id || edge.to === id;
      if (shouldRemove) {
        store.edgeStore.remove(edge, graphId);
      }
      return !shouldRemove;
    });
    // Remove the node from the graph.
    graph.nodes = graph.nodes.filter((node) => node.id != id);
    store.nodeStore.remove(id, graphId);
    return {
      success: true,
      affectedNodes: [id],
      affectedModules: [],
      affectedGraphs: [],
    };
  }
}
