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
} from "@breadboard-ai/types/edit.js";
import {
  GraphIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types/graph-descriptor.js";

export { ChangeEdgesToRoutingMode };

class ChangeEdgesToRoutingMode implements EditTransform {
  constructor(
    public readonly id: NodeIdentifier,
    public readonly graphId: GraphIdentifier
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { graphId, id } = this;
    const inspectableGraph = context.mutable.graphs.get(graphId);
    if (!inspectableGraph) {
      return {
        success: false,
        error: `Unable to find graph with id "${graphId}"`,
      };
    }
    const inspectableNode = inspectableGraph.nodeById(id);
    if (!inspectableNode) {
      return { success: false, error: `Unable to find node with id "${id}"` };
    }
    const edges = inspectableNode.outgoing();
    const edits: EditSpec[] = [];
    for (const edge of edges) {
      const oldValue = edge.raw();
      const out = edge.to.descriptor.id;
      if (oldValue.out === out) continue;
      const newValue = {
        ...oldValue,
        out,
      };
      edits.push({
        type: "changeedge",
        from: oldValue,
        to: newValue,
        graphId,
      });
    }
    return context.apply(edits, `Change edges to broadcast mode for "${id}"`);
  }
}
