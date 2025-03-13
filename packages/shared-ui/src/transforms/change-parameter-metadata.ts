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
import { TransformAllNodes } from "./transform-all-nodes";

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

    const updatingParamTitles = await new TransformAllNodes(
      graphId,
      (part) => {
        const { type, path } = part;
        if (type === "param" && path === this.id) {
          return { ...part, title: this.metadata.title };
        }
        return null;
      },
      "Updating Param Titles in @-references"
    ).apply(context);
    if (!updatingParamTitles.success) return updatingParamTitles;

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
