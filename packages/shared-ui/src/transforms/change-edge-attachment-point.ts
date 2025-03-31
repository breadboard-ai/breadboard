/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  EditOperationContext,
  EditSpec,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
} from "@google-labs/breadboard";
import { EdgeAttachmentPoint } from "../types/types";

export class ChangeEdgeAttachmentPoint implements EditTransform {
  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly edge: Edge,
    public readonly which: "from" | "to",
    public readonly attachmentPoint: EdgeAttachmentPoint
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const metadata = this.edge.metadata ?? {};
    metadata.visual ??= {};
    const visual = metadata.visual as Record<
      "from" | "to",
      EdgeAttachmentPoint
    >;
    visual[this.which] = this.attachmentPoint;

    const edits: EditSpec[] = [
      {
        type: "changeedgemetadata",
        graphId: this.graphId,
        edge: this.edge,
        metadata,
      },
    ];

    return context.apply(
      edits,
      `Change attachment point (${this.which}) to ${this.attachmentPoint}`
    );
  }
}
