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
import { NodeConfiguration } from "@breadboard-ai/types";
import {
  GraphIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types/graph-descriptor.js";
import { routesFromConfiguration } from "../../utils/control.js";

export { ChangeEdgesToRoutingMode };

class ChangeEdgesToRoutingMode implements EditTransform {
  constructor(
    public readonly id: NodeIdentifier,
    public readonly graphId: GraphIdentifier,
    public readonly configuration: NodeConfiguration
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { graphId, id, configuration } = this;
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

    const edits: EditSpec[] = [];

    // Determine the set of desired route targets from the new configuration.
    const routeTargets = new Set(routesFromConfiguration(configuration));

    // Process existing outgoing edges: rename edges to valid route targets,
    // and delete edges to targets no longer in the route list.
    const edges = inspectableNode.outgoing();
    const coveredTargets = new Set<NodeIdentifier>();
    for (const edge of edges) {
      const oldValue = edge.raw();
      const targetId = edge.to.descriptor.id;

      if (!routeTargets.has(targetId)) {
        // Target no longer in route list — delete the edge.
        edits.push({
          type: "removeedge",
          edge: oldValue,
          graphId,
        });
        continue;
      }

      coveredTargets.add(targetId);
      if (oldValue.out === targetId) continue;
      const newValue = {
        ...oldValue,
        out: targetId,
      };
      edits.push({
        type: "changeedge",
        from: oldValue,
        to: newValue,
        graphId,
      });
    }

    // Create new outgoing edges for route targets that don't already have one.
    for (const targetId of routeTargets) {
      if (coveredTargets.has(targetId)) continue;
      // Verify the target node exists.
      if (!inspectableGraph.nodeById(targetId)) continue;
      edits.push({
        type: "addedge",
        edge: {
          from: id,
          to: targetId,
          out: targetId,
          in: "context",
        },
        graphId,
      });
    }

    return context.apply(edits, `Change edges to routing mode for "${id}"`);
  }
}
