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

type InvalidItems = {
  nodes: Set<NodeIdentifier>;
  edges: Map<NodeIdentifier, NodeIdentifier>;
};

/**
 * Despite its weird name, this is the transform that takes in an EditSpec,
 * figures out which chiclets need to be marked as invalid, then applies the
 * EditSpec and then applies the necessary edits to mark chiclets as invalid.
 */
class MarkInPortsInvalidSpec implements EditTransform {
  constructor(public readonly spec: EditSpec[]) {}
  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const removedItems = new Map<GraphIdentifier, InvalidItems>();

    for (const edit of this.spec) {
      if (edit.type === "removeedge") {
        const { graphId, edge } = edit;
        if (!edge.in?.startsWith("p-z-")) continue;
        upsert(graphId).edges.set(edge.from, edge.to);
      } else if (edit.type === "removenode") {
        const { graphId, id } = edit;
        upsert(graphId).nodes.add(id);
      }
    }

    const editing = await context.apply(this.spec, "First pass: Edits");
    if (!editing) return editing;

    for (const [graphId, items] of removedItems.entries()) {
      const marking = await new TransformAllNodes(
        graphId,
        (part, nodeId) => {
          const { path } = part;
          if (items.nodes.has(path) || nodeId === items.edges.get(path)) {
            return { ...part, invalid: true };
          }
          return null;
        },
        `Marking "@" in port as invalid`,
        /* nodeTransformer */ undefined,
        /* skippedNodes */ [...items.nodes]
      ).apply(context);
      if (!marking.success) return marking;
    }

    return { success: true };

    function upsert(graphId: GraphIdentifier) {
      let items = removedItems.get(graphId);
      if (!items) {
        items = { nodes: new Set(), edges: new Map() };
        removedItems.set(graphId, items);
      }
      return items;
    }
  }
}
