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
} from "@breadboard-ai/types";
import { errorNoInspect } from "../operations/error.js";

export { ConfigureSidewireTransform };

class ConfigureSidewireTransform implements EditTransform {
  constructor(
    public readonly nodeId: NodeIdentifier,
    public readonly sidewirePortName: string,
    public readonly sourceGraphId: GraphIdentifier,
    public readonly subwiredSubgraphId: GraphIdentifier
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    if (!this.subwiredSubgraphId) {
      return {
        success: false,
        error: "Subwires may only be created to subgraphs",
      };
    }

    const { mutable, apply } = context;
    const inspector = mutable.graphs.get(this.sourceGraphId);
    if (!inspector) {
      return errorNoInspect(this.sourceGraphId);
    }
    const node = inspector.nodeById(this.nodeId);
    if (!node) {
      return {
        success: false,
        error: `Unable to find node "${this.nodeId}" in graph "${this.sourceGraphId}"`,
      };
    }

    const { graph } = context;
    if (!graph.graphs?.[this.subwiredSubgraphId]) {
      return {
        success: false,
        error: `Unable to find subgraph "${this.subwiredSubgraphId}`,
      };
    }

    const configuring = await apply(
      [
        {
          type: "changeconfiguration",
          id: this.nodeId,
          graphId: this.sourceGraphId,
          configuration: { [this.sidewirePortName]: this.subwiredSubgraphId },
        },
      ],
      "Configuring side wire"
    );
    if (!configuring.success) {
      return configuring;
    }

    return { success: true };
  }
}
