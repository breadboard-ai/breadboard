/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeIdentifier } from "@breadboard-ai/types";
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

  constructor(nodes: NodeIdentifier[]) {
    this.#nodes = nodes;
  }

  async createSpec(
    context: EditOperationContext
  ): Promise<EditTransformResult> {
    const { inspector } = context;
    const selection = computeSelection(inspector, this.#nodes);
    if (!selection.success) {
      return {
        success: false,
        error: selection.error,
      };
    }
    const { dangling } = selection;
    const edits: RemoveEdgeSpec[] = dangling.map((edge) => ({
      type: "removeedge",
      edge,
    }));

    return {
      success: true,
      spec: [edits, "Isolating Selection"],
    };
  }
}
