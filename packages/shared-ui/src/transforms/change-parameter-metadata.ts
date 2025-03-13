/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphMetadata, ParameterMetadata } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
} from "@google-labs/breadboard";

export { ChangeParameterMetadata };

/**
 * Unlike `UpdateParameterMetadata`, this transform only changes the metadata
 * of one parameter.
 */
class ChangeParameterMetadata implements EditTransform {
  constructor(
    public readonly id: string,
    public readonly metadata: ParameterMetadata,
    public readonly graphId: string
  ) {}
  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const graphId = this.graphId;
    const inspectable = context.mutable.graphs.get(graphId);
    if (!inspectable) {
      return {
        success: false,
        error: `Unable to inspect graph with id "${graphId}"`,
      };
    }

    const current = inspectable.metadata();

    const allParams = current?.parameters;
    if (!allParams) {
      return {
        success: false,
        error: `No parameter metadata present in graph`,
      };
    }

    const param = allParams[this.id];
    if (!param) {
      return {
        success: false,
        error: `No parameter metadata present for "${this.id}"`,
      };
    }

    const metadata: GraphMetadata = {
      ...current,
      parameters: {
        ...allParams,
        [this.id]: { ...this.metadata, usedIn: param.usedIn },
      },
    };

    // TODO: Update all titles too.

    return context.apply(
      [
        {
          type: "changegraphmetadata",
          graphId,
          metadata,
        },
      ],
      `Updating parameter metadata for "${this.id}"`
    );
  }
}
