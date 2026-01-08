/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  NodeIdentifier,
  RemoveEdgeSpec,
} from "@breadboard-ai/types";
import { errorNoInspect } from "../operations/error.js";
import { computeSelection } from "../selection.js";

export { IsolateSelectionTransform };

class IsolateSelectionTransform implements EditTransform {
  #nodes: NodeIdentifier[];
  #graphId: GraphIdentifier;

  constructor(nodes: NodeIdentifier[], graphId: GraphIdentifier) {
    this.#nodes = nodes;
    this.#graphId = graphId;
  }

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { mutable } = context;
    const inspector = mutable.graphs.get(this.#graphId);
    if (!inspector) {
      return errorNoInspect(this.#graphId);
    }
    const selection = computeSelection(inspector, this.#nodes);
    if (!selection.success) {
      return selection;
    }
    const { dangling } = selection;
    const edits: RemoveEdgeSpec[] = dangling.map((edge) => ({
      type: "removeedge",
      edge,
      graphId: this.#graphId,
    }));

    const result = await context.apply(edits, "Isolating Selection");
    if (!result.success) {
      return result;
    }

    return { success: true };
  }
}
