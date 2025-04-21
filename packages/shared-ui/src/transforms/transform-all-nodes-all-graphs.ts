/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  NodeIdentifier,
} from "@google-labs/breadboard";
import {
  EditTransformFactory,
  TemplatePartTransformer,
  TransformAllNodes,
} from "./transform-all-nodes";

export { TransformAllNodesAllGraphs };

class TransformAllNodesAllGraphs implements EditTransform {
  constructor(
    public readonly templateTransformer: TemplatePartTransformer,
    public readonly logMessage: string,
    public readonly nodeTransfomer?: EditTransformFactory,
    public readonly skippedNodes?: NodeIdentifier[]
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const graphIds = [...Object.keys(context.graph.graphs || {}), ""];

    for (const graphId of graphIds) {
      const updatingGraph = await new TransformAllNodes(
        graphId,
        this.templateTransformer,
        this.logMessage,
        this.nodeTransfomer,
        this.skippedNodes
      ).apply(context);
      if (!updatingGraph.success) return updatingGraph;
    }

    return { success: true };
  }
}
