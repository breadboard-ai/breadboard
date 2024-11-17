/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  RemoveEdgeSpec,
} from "../types.js";
import { computeSelection } from "../selection.js";

export { IsolateSelectionTransform };

class IsolateSelectionTransform implements EditTransform {
  #nodes: NodeIdentifier[];
  #graphId: GraphIdentifier;

  constructor(nodes: NodeIdentifier[], graphId: GraphIdentifier) {
    this.#nodes = nodes;
    this.#graphId = graphId;
  }

  async createSpec(
    context: EditOperationContext
  ): Promise<EditTransformResult> {
    const { inspector } = context;
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

    return {
      success: true,
      spec: { edits, label: "Isolating Selection" },
    };
  }
}
