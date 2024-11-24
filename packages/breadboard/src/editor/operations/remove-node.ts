/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "../types.js";
import { InspectableGraph } from "../../inspector/types.js";
import { errorNoInspect } from "./error.js";
import { GraphDescriptorHandle } from "../../inspector/graph/graph-descriptor-handle.js";

export class RemoveNode implements EditOperation {
  async can(
    id: NodeIdentifier,
    inspector: InspectableGraph,
    graphId: GraphIdentifier
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
      affectedNodes: [{ id, graphId }],
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
    const { mutable } = context;
    const inspector = mutable.graphs.get(graphId);
    if (!inspector) {
      return errorNoInspect(graphId);
    }
    const can = await this.can(id, inspector, graphId);
    if (!can.success) {
      return can;
    }
    const handle = GraphDescriptorHandle.create(context.graph, graphId);
    if (!handle.success) {
      return handle;
    }
    const graph = handle.result.graph();

    // Remove any edges that are connected to the removed node.
    graph.edges = graph.edges.filter((edge) => {
      const shouldRemove = edge.from === id || edge.to === id;
      if (shouldRemove) {
        mutable.edges.remove(edge, graphId);
      }
      return !shouldRemove;
    });
    // Remove the node from the graph.
    graph.nodes = graph.nodes.filter((node) => node.id != id);
    mutable.nodes.remove(id, graphId);
    return {
      success: true,
      affectedNodes: [{ id, graphId }],
      affectedModules: [],
      affectedGraphs: [],
    };
  }
}
