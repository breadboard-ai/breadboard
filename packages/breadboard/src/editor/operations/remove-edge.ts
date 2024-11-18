/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  EditableEdgeSpec,
  SingleEditResult,
} from "../types.js";
import { InspectableGraph } from "../../inspector/types.js";
import { fixUpStarEdge } from "../../inspector/edge.js";
import { findEdgeIndex } from "../edge.js";
import { toSubgraphContext } from "../subgraph-context.js";

export class RemoveEdge implements EditOperation {
  async can(
    spec: EditableEdgeSpec,
    inspector: InspectableGraph
  ): Promise<SingleEditResult> {
    if (!inspector.hasEdge(spec)) {
      return {
        success: false,
        error: `Edge from "${spec.from}:${spec.out}" to "${spec.to}:${spec.in}" does not exist`,
      };
    }
    return {
      success: true,
      affectedNodes: [spec.from, spec.to],
      affectedModules: [],
      affectedGraphs: [],
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
    const subgraphContext = toSubgraphContext(context, graphId);
    if (!subgraphContext.success) {
      return subgraphContext;
    }
    const { graph, inspector, store } = subgraphContext.result;
    const can = await this.can(edge, inspector);
    if (!can.success) {
      return can;
    }
    edge = fixUpStarEdge(edge);
    const edges = graph.edges;
    const index = findEdgeIndex(graph, edge);
    const foundEdge = edges.splice(index, 1)[0];
    store.edgeStore.remove(foundEdge, graphId);
    return {
      success: true,
      affectedNodes: [edge.from, edge.to],
      affectedModules: [],
      affectedGraphs: [],
    };
  }
}
