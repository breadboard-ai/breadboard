/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  EditableNodeSpec,
  SingleEditResult,
} from "../types.js";
import { InspectableGraph } from "../../inspector/types.js";
import { errorNoInspect } from "./error.js";
import { GraphDescriptorHandle } from "../../inspector/graph/graph-descriptor-handle.js";

export class AddNode implements EditOperation {
  async can(
    spec: EditableNodeSpec,
    inspector: InspectableGraph
  ): Promise<SingleEditResult> {
    const duplicate = !!inspector.nodeById(spec.id);
    if (duplicate) {
      return {
        success: false,
        error: `Unable to add node: a node with id "${spec.id}" already exists`,
      };
    }

    const validType = !!inspector.typeById(spec.type);
    if (!validType) {
      return {
        success: false,
        error: `Unable to add node: node type "${spec.type}" is not a known type`,
      };
    }

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
    if (spec.type !== "addnode") {
      throw new Error(
        `Editor API integrity error: expected type "addnode", received "${spec.type}" instead.`
      );
    }
    const { node, graphId } = spec;

    const { graph, mutable } = context;
    const inspector = mutable.graphs.get(graphId);
    if (!inspector) {
      return errorNoInspect(graphId);
    }

    const handle = GraphDescriptorHandle.create(graph, graphId);
    if (!handle.success) {
      return handle;
    }

    const can = await this.can(node, inspector);
    if (!can.success) {
      return can;
    }

    handle.result.graph().nodes.push(node);
    mutable.nodes.add(node, graphId);
    return {
      success: true,
      affectedNodes: [{ id: node.id, graphId }],
      affectedModules: [],
      affectedGraphs: [],
    };
  }
}
