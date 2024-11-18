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
} from "../types.js";
import { toSubgraphContext } from "../subgraph-context.js";

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

    const sourceContext = toSubgraphContext(context, this.sourceGraphId);
    if (!sourceContext.success) {
      return sourceContext;
    }

    const { inspector, apply } = sourceContext.result;

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
