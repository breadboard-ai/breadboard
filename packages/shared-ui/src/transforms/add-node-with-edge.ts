/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  NodeDescriptor,
} from "@google-labs/breadboard";
import { ChangeEdge } from "./change-edge";

export { AddNodeWithEdge };

class AddNodeWithEdge implements EditTransform {
  constructor(
    public readonly node: NodeDescriptor,
    public readonly from: Edge,
    public readonly graphId: GraphIdentifier
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    await context.apply(
      [{ type: "addnode", node: this.node, graphId: this.graphId }],
      `Add step: ${this.node.metadata?.title ?? "Untitled step"}`
    );
    return new ChangeEdge("add", this.graphId, this.from, undefined).apply(
      context
    );
  }
}
