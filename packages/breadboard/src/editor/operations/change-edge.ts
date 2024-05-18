/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableGraph } from "../../inspector/types.js";
import {
  EdgeEditResult,
  EditOperation,
  EditOperationContext,
  EditSpec,
  EditableEdgeSpec,
  SingleEditResult,
} from "../types.js";
import { RemoveEdge } from "./remove-edge.js";
import { AddEdge } from "./add-edge.js";
import { edgesEqual, findEdgeIndex } from "../edge.js";
import { fixUpStarEdge } from "../../inspector/edge.js";

export class ChangeEdge implements EditOperation {
  async can(
    from: EditableEdgeSpec,
    to: EditableEdgeSpec,
    inspector: InspectableGraph
  ): Promise<EdgeEditResult> {
    if (edgesEqual(from, to)) {
      return { success: true };
    }
    const canRemoveOp = new RemoveEdge();
    const canRemove = await canRemoveOp.can(from, inspector);
    if (!canRemove.success) return canRemove;
    const canAddOp = new AddEdge();
    const canAdd = await canAddOp.can(to, inspector);
    if (!canAdd.success) return canAdd;
    return { success: true };
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
    const from = spec.from;
    let to = spec.to;
    const strict = spec.strict;

    const { graph, inspector } = context;
    const can = await this.can(from, to, inspector);
    let alternativeChosen = false;
    if (!can.success) {
      if (!can.alternative || strict) {
        return can;
      }
      to = can.alternative;
      alternativeChosen = true;
    }
    if (edgesEqual(from, to)) {
      if (alternativeChosen) {
        const error = `Edge from ${from.from}:${from.out}" to "${to.to}:${to.in}" already exists`;
        return {
          success: false,
          error,
        };
      }
      return { success: true, nochange: true };
    }
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
    return { success: true };
  }
}
