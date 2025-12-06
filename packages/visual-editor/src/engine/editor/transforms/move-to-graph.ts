/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AddEdgeSpec,
  AddNodeSpec,
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  NodeIdentifier,
  RemoveEdgeSpec,
  RemoveNodeSpec,
} from "@breadboard-ai/types";
import { errorNoInspect } from "../operations/error.js";
import { computeSelection } from "../selection.js";
import { IsolateSelectionTransform } from "./isolate-selection.js";

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

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const isolatedSelection = await new IsolateSelectionTransform(
      this.#nodes,
      this.#source
    ).apply(context);
    if (!isolatedSelection.success) {
      return isolatedSelection;
    }

    const sourceInspector = context.mutable.graphs.get(this.#source);
    if (!sourceInspector) {
      return errorNoInspect(this.#source);
    }

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

    const result = await context.apply(
      [...nodeAdditions, ...edgeAdditions, ...edgeRemovals, ...nodeRemovals],
      label
    );

    if (!result.success) {
      return result;
    }

    return {
      success: true,
    };
  }
}
