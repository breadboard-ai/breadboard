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
  InspectableGraph,
  SingleEditResult,
} from "@breadboard-ai/types";
import { GraphIdentifier } from "@breadboard-ai/types";
import {
  fixUpStarEdge,
  fixupConstantEdge,
  unfixUpStarEdge,
} from "./edge-utils.js";
import { GraphDescriptorHandle } from "../graph-descriptor-handle.js";
import { errorNoInspect } from "./error.js";

export class AddEdge implements EditOperation {
  async can(
    edge: EditableEdgeSpec,
    inspector: InspectableGraph,
    graphId: GraphIdentifier
  ): Promise<SingleEditResult> {
    edge = unfixUpStarEdge(edge);
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
    const { graphId } = spec;

    const { graph, mutable } = context;
    const inspector = mutable.graphs.get(graphId);
    if (!inspector) {
      return errorNoInspect(graphId);
    }
    const can = await this.can(edge, inspector, graphId);
    if (!can.success) {
      return can;
    }
    const handle = GraphDescriptorHandle.create(graph, graphId);
    if (!handle.success) {
      return handle;
    }

    edge = fixUpStarEdge(edge);
    edge = fixupConstantEdge(edge);
    handle.result.graph().edges.push(edge);
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
