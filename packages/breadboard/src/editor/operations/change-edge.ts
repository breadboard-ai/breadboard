/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableGraph } from "../../inspector/types.js";
import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  EditableEdgeSpec,
  SingleEditResult,
} from "../types.js";
import { RemoveEdge } from "./remove-edge.js";
import { AddEdge } from "./add-edge.js";
import { edgesEqual, findEdgeIndex } from "../edge.js";
import { fixUpStarEdge } from "../../inspector/graph/edge.js";
import { GraphIdentifier } from "@breadboard-ai/types";
import { errorNoInspect } from "./error.js";
import { GraphDescriptorHandle } from "../../inspector/graph/graph-descriptor-handle.js";

export class ChangeEdge implements EditOperation {
  async can(
    from: EditableEdgeSpec,
    to: EditableEdgeSpec,
    inspector: InspectableGraph,
    graphId: GraphIdentifier
  ): Promise<SingleEditResult> {
    if (edgesEqual(from, to)) {
      return {
        success: true,
        affectedNodes: [],
        affectedModules: [],
        affectedGraphs: [],
      };
    }
    const canRemoveOp = new RemoveEdge();
    const canRemove = await canRemoveOp.can(from, inspector, graphId);
    if (!canRemove.success) return canRemove;
    const canAddOp = new AddEdge();
    const canAdd = await canAddOp.can(to, inspector, graphId);
    if (!canAdd.success) return canAdd;
    return {
      success: true,
      affectedNodes: [],
      affectedModules: [],
      affectedGraphs: [],
    };
  }

  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "changeedge") {
      throw new Error(
        `Editor API integrity error: expected type "changeedge", received "${spec.type}" instead.`
      );
    }
    const { from, to, graphId } = spec;
    const { mutable } = context;
    const inspector = mutable.graphs.get(graphId);
    if (!inspector) {
      return errorNoInspect(graphId);
    }

    const can = await this.can(from, to, inspector, graphId);
    if (!can.success) {
      return can;
    }
    if (edgesEqual(from, to)) {
      return {
        success: true,
        noChange: true,
        affectedNodes: [],
        affectedModules: [],
        affectedGraphs: [],
      };
    }
    const handle = GraphDescriptorHandle.create(context.graph, graphId);
    if (!handle.success) {
      return handle;
    }
    const graph = handle.result.graph();

    const fixedUpEdge = fixUpStarEdge(from);
    const edges = graph.edges;
    const index = findEdgeIndex(graph, fixedUpEdge);
    const edge = edges[index];
    edge.from = to.from;
    edge.out = to.out;
    edge.to = to.to;
    edge.in = to.in;
    if (to.constant === true) {
      edge.constant = to.constant;
    }
    return {
      success: true,
      affectedNodes: [
        { id: edge.from, graphId },
        { id: edge.to, graphId },
      ],
      affectedModules: [],
      affectedGraphs: [],
    };
  }
}
