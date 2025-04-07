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
  GraphIdentifier,
  NodeIdentifier,
} from "@google-labs/breadboard";
import { TransformAllNodes } from "./transform-all-nodes";

export { MarkInPortsInvalidSpec };

class MarkInPortsInvalidSpec implements EditTransform {
  constructor(public readonly spec: EditSpec[]) {}
  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const removedNodes = new Map<GraphIdentifier, Set<NodeIdentifier>>();

    for (const edit of this.spec) {
      if (edit.type === "removeedge") {
        const {
          graphId,
          edge: { from, in: inPort },
        } = edit;
        if (!inPort?.startsWith("p-z-")) continue;
        upsert(graphId, from);
      } else if (edit.type === "removenode") {
        const { graphId, id } = edit;
        upsert(graphId, id);
      }
    }

    const editing = await context.apply(this.spec, "First pass: Edits");
    if (!editing) return editing;

    for (const [graphId, ids] of removedNodes.entries()) {
      const marking = await new TransformAllNodes(
        graphId,
        (part) => {
          const { path } = part;
          if (ids.has(path)) return { ...part, invalid: true };
          return null;
        },
        `Marking "@" in port as invalid`,
        /* nodeTransformer */ undefined,
        /* skippedNodes */ [...ids]
      ).apply(context);
      if (!marking.success) return marking;
    }

    return { success: true };

    function upsert(graphId: GraphIdentifier, id: NodeIdentifier) {
      let ids = removedNodes.get(graphId);
      if (!ids) {
        ids = new Set();
        removedNodes.set(graphId, ids);
      }
      ids.add(id);
    }
  }
}
