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
import { fixUpStarEdge, fixupConstantEdge } from "../../inspector/edge.js";

export class AddEdge implements EditOperation {
  async can(
    edge: EditableEdgeSpec,
    inspector: InspectableGraph
  ): Promise<SingleEditResult> {
    if (inspector.hasEdge(edge)) {
      return {
        success: false,
        error: `Edge from "${edge.from}:${edge.out}" to "${edge.to}:${edge.in}" already exists`,
      };
    }
    const from = inspector.nodeById(edge.from);
    if (!from) {
      return {
        success: false,
        error: `Node with id "${edge.from}" does not exist, but is required as the "from" part of the edge`,
      };
    }
    const to = inspector.nodeById(edge.to);
    if (!to) {
      return {
        success: false,
        error: `Node with id "${edge.to}" does not exist, but is required as the "to" part of the edge`,
      };
    }

    let error: string | null = null;
    if (edge.out === "*" && edge.in !== "*") {
      error = `A "*" output port cannot be connected to a named or control input port`;
    } else if (edge.out === "" && edge.in !== "") {
      error = `A control input port cannot be connected to a named or "*" output part`;
    } else if (edge.in === "*" && edge.out !== "*") {
      error = `A named input port cannot be connected to a "*" output port`;
    } else if (edge.in === "" && edge.out !== "") {
      error = `A named input port cannot be connected to a control output port`;
    }
    if (error) {
      return { success: false, error };
    }

    const fromPorts = (await from.ports()).outputs;
    if (fromPorts.fixed) {
      const found = fromPorts.ports.find((port) => port.name === edge.out);
      if (!found) {
        error ??= `Node with id "${edge.from}" does not have an output port named "${edge.out}"`;
        return {
          success: false,
          error,
        };
      }
    }
    const toPorts = (await to.ports()).inputs;
    if (toPorts.fixed) {
      const found = toPorts.ports.find((port) => port.name === edge.in);
      if (!found) {
        error ??= `Node with id "${edge.to}" does not have an input port named "${edge.in}"`;
        return {
          success: false,
          error,
        };
      }
    }
    return { success: true };
  }

  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "addedge") {
      throw new Error(
        `Editor API integrity error: expected type "addedge", received "${spec.type}" instead.`
      );
    }
    let edge = spec.edge;
    const { graph, inspector, store } = context;
    const can = await this.can(edge, inspector);
    if (!can.success) {
      return can;
    }
    edge = fixUpStarEdge(edge);
    edge = fixupConstantEdge(edge);
    // TODO: Figure out how to make this work in multi-edit mode.
    store.edgeStore.add(edge);
    graph.edges.push(edge);
    return { success: true };
  }
}
