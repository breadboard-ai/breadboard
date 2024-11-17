/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import {
  AddEdgeSpec,
  AddNodeSpec,
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  RemoveEdgeSpec,
  RemoveNodeSpec,
} from "../types.js";
import { IsolateSelectionTransform } from "./isolate-selection.js";
import { toSubgraphContext } from "../subgraph-context.js";
import { computeSelection } from "../selection.js";

export { MoveToGraphTransform };

class MoveToGraphTransform implements EditTransform {
  #nodes: NodeIdentifier[];
  #source: GraphIdentifier;
  #destination: GraphIdentifier;

  constructor(
    nodes: NodeIdentifier[],
    source: GraphIdentifier,
    destination: GraphIdentifier
  ) {
    this.#nodes = nodes;
    this.#source = source;
    this.#destination = destination;
  }

  #friendlyGraphName(id: GraphIdentifier) {
    return id ? `graph "${id}"` : "main graph";
  }

  async createSpec(
    context: EditOperationContext
  ): Promise<EditTransformResult> {
    const sourceContext = toSubgraphContext(context, this.#source);
    if (!sourceContext.success) {
      return sourceContext;
    }
    const isolatedSelection = await new IsolateSelectionTransform(
      this.#nodes,
      this.#source
    ).createSpec(sourceContext.result);
    if (!isolatedSelection.success) {
      return isolatedSelection;
    }

    const sourceInspector = sourceContext.result.inspector;

    const selection = computeSelection(sourceInspector, this.#nodes);
    if (!selection.success) {
      return selection;
    }

    const nodeAdditions: AddNodeSpec[] = selection.nodes.map((id) => ({
      type: "addnode",
      node: sourceInspector.nodeById(id)!.descriptor,
      graphId: this.#destination,
    }));

    const edgeAdditions: AddEdgeSpec[] = selection.edges.map((edge) => ({
      type: "addedge",
      edge,
      graphId: this.#destination,
    }));

    const nodeRemovals: RemoveNodeSpec[] = selection.nodes.map((id) => ({
      type: "removenode",
      id,
      graphId: this.#source,
    }));

    const edgeRemovals: RemoveEdgeSpec[] = selection.edges.map((edge) => ({
      type: "removeedge",
      edge,
      graphId: this.#source,
    }));

    const label = `Moving ${this.#nodes.length} nodes from ${this.#friendlyGraphName(this.#source)} to ${this.#friendlyGraphName(this.#source)}`;

    return {
      success: true,
      spec: {
        edits: [
          ...isolatedSelection.spec.edits,
          ...nodeAdditions,
          ...edgeAdditions,
          ...edgeRemovals,
          ...nodeRemovals,
        ],
        label,
      },
    };
  }
}
