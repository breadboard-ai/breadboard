/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditOperation,
  EditOperationContext,
  EditSpec,
  EditableEdgeSpec,
  GraphIdentifier,
  InspectableGraph,
  SingleEditResult,
} from "@breadboard-ai/types";
import { fixUpStarEdge } from "./edge-utils.js";
import { GraphDescriptorHandle } from "../graph-descriptor-handle.js";
import { findEdgeIndex } from "../edge.js";
import { errorNoInspect } from "./error.js";

export class RemoveEdge implements EditOperation {
  async can(
    spec: EditableEdgeSpec,
    inspector: InspectableGraph,
    graphId: GraphIdentifier
  ): Promise<SingleEditResult> {
    if (!inspector.hasEdge(spec)) {
      return {
        success: false,
        error: `Edge from "${spec.from}:${spec.out}" to "${spec.to}:${spec.in}" does not exist`,
      };
    }
    return {
      success: true,
      affectedNodes: [
        { id: spec.from, graphId },
        { id: spec.to, graphId },
      ],
      affectedGraphs: [],
      topologyChange: true,
    };
  }

  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "removeedge") {
      throw new Error(
        `Editor API integrity error: expected type "removeedge", received "${spec.type}" instead.`
      );
    }
    let edge = spec.edge;
    const { graphId } = spec;
    const { mutable } = context;
    const inspector = mutable.graphs.get(graphId);
    if (!inspector) {
      return errorNoInspect(graphId);
    }

    const can = await this.can(edge, inspector, graphId);
    if (!can.success) {
      return can;
    }
    const handle = GraphDescriptorHandle.create(context.graph, graphId);
    if (!handle.success) {
      return handle;
    }
    const graph = handle.result.graph();

    edge = fixUpStarEdge(edge);
    const edges = graph.edges;
    const index = findEdgeIndex(graph, edge);
    edges.splice(index, 1);
    return {
      success: true,
      affectedNodes: [
        { id: edge.from, graphId },
        { id: edge.to, graphId },
      ],
      affectedGraphs: [graphId],
      topologyChange: true,
    };
  }
}
