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
import { transformConfiguration } from "./transform-all-nodes";

export { MarkInPortsInvalid };

class MarkInPortsInvalid implements EditTransform {
  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly from: NodeIdentifier,
    public readonly to: NodeIdentifier
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const graphId = this.graphId;
    const inspectable = context.mutable.graphs.get(graphId);
    if (!inspectable)
      return {
        success: false,
        error: `Unable to inspect graph with id "${graphId}"`,
      };

    const node = inspectable.nodeById(this.to);
    if (!node) {
      return {
        success: false,
        error: `Unable to find the node by id "${this.to}"`,
      };
    }

    const newConfig = transformConfiguration(
      this.to,
      node.configuration(),
      (part) => {
        const { path } = part;
        if (path === this.from) {
          return { ...part, invalid: true };
        }
        return null;
      }
    );
    if (newConfig !== null) {
      return context.apply(
        [
          {
            type: "changeconfiguration",
            id: this.to,
            configuration: newConfig,
            reset: true,
            graphId,
          },
        ],
        `Marking "@" in port as invalid`
      );
    }

    return { success: true };
  }
}
