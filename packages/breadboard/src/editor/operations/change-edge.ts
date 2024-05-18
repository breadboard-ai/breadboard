/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import { InspectableGraphWithStore } from "../../inspector/types.js";
import {
  EdgeEditResult,
  EditOperation,
  EditSpec,
  EditableEdgeSpec,
  SingleEditResult,
} from "../types.js";
import { RemoveEdge } from "./remove-edge.js";
import { AddEdge } from "./add-edge.js";
import { edgesEqual, findEdgeIndex } from "../edge.js";
import { fixUpStarEdge } from "../../inspector/edge.js";

export class ChangeEdge implements EditOperation {
  #graph: GraphDescriptor;
  #inspector: InspectableGraphWithStore;

  constructor(graph: GraphDescriptor, inspector: InspectableGraphWithStore) {
    this.#graph = graph;
    this.#inspector = inspector;
  }

  async can(
    from: EditableEdgeSpec,
    to: EditableEdgeSpec
  ): Promise<EdgeEditResult> {
    if (edgesEqual(from, to)) {
      return { success: true };
    }
    const canRemoveOp = new RemoveEdge(this.#graph, this.#inspector);
    const canRemove = await canRemoveOp.can(from);
    if (!canRemove.success) return canRemove;
    const canAddOp = new AddEdge(this.#graph, this.#inspector);
    const canAdd = await canAddOp.can(to);
    if (!canAdd.success) return canAdd;
    return { success: true };
  }

  async do(spec: EditSpec): Promise<SingleEditResult> {
    if (spec.type !== "changeedge") {
      throw new Error(
        `Editor API integrity error: expected type "changeedge", received "${spec.type}" instead.`
      );
    }
    const from = spec.from;
    let to = spec.to;
    const strict = spec.strict;

    const can = await this.can(from, to);
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
    const edges = this.#graph.edges;
    const index = findEdgeIndex(this.#graph, fixedUpEdge);
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
