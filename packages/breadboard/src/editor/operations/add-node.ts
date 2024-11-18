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
import { toSubgraphContext } from "../subgraph-context.js";

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
    const subgraphContext = toSubgraphContext(context, graphId);
    if (!subgraphContext.success) {
      return subgraphContext;
    }

    const { graph, inspector, store } = subgraphContext.result;
    const can = await this.can(node, inspector);
    if (!can.success) {
      return can;
    }

    graph.nodes.push(node);
    store.nodeStore.add(node, graphId);
    return {
      success: true,
      affectedNodes: [node.id],
      affectedModules: [],
      affectedGraphs: [],
    };
  }
}
