/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  NodeIdentifier,
} from "@google-labs/breadboard";
import { AutoWireInPorts } from "./autowire-in-ports";
import { TransformAllNodes } from "./transform-all-nodes";

export { UpdateNodeTitle };

class UpdateNodeTitle implements EditTransform {
  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly nodeId: NodeIdentifier,
    public readonly title: string
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const graphId = this.graphId;

    return new TransformAllNodes(
      graphId,
      (part) => {
        const { type, path } = part;
        if (type === "in" && path === this.nodeId) {
          return { type, path, title: this.title };
        }
        return null;
      },
      "Updating Node Titles in @-references.",
      (id) => {
        return new AutoWireInPorts(id, graphId, [
          { path: this.nodeId, title: this.title },
        ]);
      }
    ).apply(context);
  }
}
