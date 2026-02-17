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
} from "@breadboard-ai/types";
import { TransformAllNodes } from "./transform-all-nodes.js";
import { ROUTE_TOOL_PATH } from "../../a2/a2/tool-manager.js";

export { MarkInPortsInvalidSpec };

type InvalidItems = {
  nodes: Set<NodeIdentifier>;
  edges: Map<NodeIdentifier, NodeIdentifier>;
  /** Routing edges: source node → set of removed route target node IDs. */
  routeEdges: Map<NodeIdentifier, Set<NodeIdentifier>>;
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
        // Routing edges have out === to (the out port is the target node ID).
        // They don't use the p-z- prefix convention so must be tracked
        // separately.
        if (edge.out === edge.to) {
          const items = upsert(graphId);
          let targets = items.routeEdges.get(edge.from);
          if (!targets) {
            targets = new Set();
            items.routeEdges.set(edge.from, targets);
          }
          targets.add(edge.to);
          continue;
        }
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
          const { path, type, instance } = part;
          if (items.nodes.has(path) || nodeId === items.edges.get(path)) {
            return { ...part, invalid: true };
          }
          if (
            type === "tool" &&
            path === ROUTE_TOOL_PATH &&
            instance &&
            items.routeEdges.get(nodeId)?.has(instance)
          ) {
            // Unset the route target — the user explicitly deleted the edge,
            // so the "Go to..." chip should revert to an untargeted state
            // rather than disappear or stay dangling.
            return { type, path, title: "Target" };
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
        items = {
          nodes: new Set(),
          edges: new Map(),
          routeEdges: new Map(),
        };
        removedItems.set(graphId, items);
      }
      return items;
    }
  }
}
