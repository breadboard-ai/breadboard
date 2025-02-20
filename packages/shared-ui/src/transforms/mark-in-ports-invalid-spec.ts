/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperationContext,
  EditSpec,
  EditTransform,
  EditTransformResult,
  RemoveEdgeSpec,
} from "@google-labs/breadboard";
import { MarkInPortsInvalid } from "./mark-in-ports-invalid";

export { MarkInPortsInvalidSpec };

class MarkInPortsInvalidSpec implements EditTransform {
  constructor(public readonly spec: EditSpec[]) {}
  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const removedNodes = new Set<string>();
    const removedEdges: RemoveEdgeSpec[] = [];

    for (const edit of this.spec) {
      if (edit.type === "removeedge") {
        removedEdges.push(edit);
      }
      if (edit.type === "removenode") {
        removedNodes.add(`${edit.id}|${edit.graphId}`);
      }
    }

    const editing = await context.apply(this.spec, "Editing");
    if (!editing) return editing;

    for (const removeEdgeSpec of removedEdges) {
      const nodeKey = `${removeEdgeSpec.edge.to}|${removeEdgeSpec.graphId}`;
      if (removedNodes.has(nodeKey)) continue;

      const marking = await new MarkInPortsInvalid(
        removeEdgeSpec.graphId,
        removeEdgeSpec.edge.from,
        removeEdgeSpec.edge.to
      ).apply(context);

      if (!marking.success) return marking;
    }

    return { success: true };
  }
}
