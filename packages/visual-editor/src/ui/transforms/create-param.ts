/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
} from "@google-labs/breadboard";

export { CreateParam };

/**
 * This transform creates params in the graph metadata.
 */
class CreateParam implements EditTransform {
  constructor(
    public readonly graphId: string,
    public readonly path: string,
    public readonly title: string,
    public readonly description?: string
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const graphId = this.graphId;
    if (graphId) {
      // For now, don't add subgraph params to the parameter metadata list.
      return { success: true };
    }

    const inspectable = context.mutable.graphs.get(graphId);

    if (!inspectable) {
      return {
        success: false,
        error: `Unable to inspect graph with id "${graphId}"`,
      };
    }

    const metadata = structuredClone(inspectable.metadata() ?? {});
    metadata.parameters ??= {};

    metadata.parameters[this.path] = {
      title: this.title,
      usedIn: [],
    };

    if (this.description) {
      metadata.parameters[this.path].description = this.description;
    }

    const updating = await context.apply(
      [
        {
          type: "changegraphmetadata",
          graphId,
          metadata,
        },
      ],
      "Updating graph parameter metadata"
    );

    if (!updating.success) return updating;

    return { success: true };
  }
}
