/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import {
  EditOperation,
  EditSpec,
  EditableEdgeSpec,
  SingleEditResult,
} from "../types.js";
import { InspectableGraphWithStore } from "../../inspector/types.js";
import { fixUpStarEdge } from "../../inspector/edge.js";
import { findEdgeIndex } from "../edge.js";

export class RemoveEdge implements EditOperation {
  #graph: GraphDescriptor;
  #inspector: InspectableGraphWithStore;

  constructor(graph: GraphDescriptor, inspector: InspectableGraphWithStore) {
    this.#graph = graph;
    this.#inspector = inspector;
  }

  async can(spec: EditableEdgeSpec): Promise<SingleEditResult> {
    if (!this.#inspector.hasEdge(spec)) {
      return {
        success: false,
        error: `Edge from "${spec.from}:${spec.out}" to "${spec.to}:${spec.in}" does not exist`,
      };
    }
    return { success: true };
  }

  async do(spec: EditSpec): Promise<SingleEditResult> {
    if (spec.type !== "removeedge") {
      throw new Error(
        `Editor API integrity error: expected type "removeedge", received "${spec.type}" instead.`
      );
    }
    let edge = spec.edge;
    const can = await this.can(edge);
    if (!can.success) {
      return can;
    }
    edge = fixUpStarEdge(edge);
    const edges = this.#graph.edges;
    const index = findEdgeIndex(this.#graph, edge);
    const foundEdge = edges.splice(index, 1)[0];
    this.#inspector.edgeStore.remove(foundEdge);
    return { success: true };
  }
}
