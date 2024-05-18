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
    return { success: true };
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
    const { graph, inspector, store } = context;
    const can = await this.can(edge, inspector);
    if (!can.success) {
      return can;
    }
    edge = fixUpStarEdge(edge);
    const edges = graph.edges;
    const index = findEdgeIndex(graph, edge);
    const foundEdge = edges.splice(index, 1)[0];
    store.edgeStore.remove(foundEdge);
    return { success: true };
  }
}
