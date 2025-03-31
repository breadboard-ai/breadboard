/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditSpec,
  EditTransform,
  EditTransformResult,
  NodeIdentifier,
} from "@google-labs/breadboard";

export { MoveNodesToGraph };

class MoveNodesToGraph implements EditTransform {
  constructor(
    public readonly ids: NodeIdentifier[],
    public readonly sourceGraphId: GraphIdentifier,
    // A null value here means to create a new subgraph.
    public readonly destGraphId: GraphIdentifier | null = null,
    public readonly positionDelta: DOMPoint | null = null
  ) {
    if (this.destGraphId === null) {
      this.destGraphId = globalThis.crypto.randomUUID();
    }
  }

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { ids, sourceGraphId, destGraphId } = this;
    const inspectableGraph = context.mutable.graphs.get(sourceGraphId);
    if (!inspectableGraph) {
      return {
        success: false,
        error: `Unable to inspect graph with id "${sourceGraphId}"`,
      };
    }

    const edits: EditSpec[] = [];

    // If the target isn't the main board, we need to create it.
    if (destGraphId && !context.mutable.graphs.get(destGraphId)) {
      edits.push({
        type: "addgraph",
        id: destGraphId,
        graph: {
          title: "Custom Tool",
          nodes: [],
          edges: [],
        },
      });
    }

    const remappedIds = new Map<string, string>();
    const edgesToRetain = inspectableGraph
      .edges()
      .filter(
        (edge) =>
          ids.includes(edge.from.descriptor.id) ||
          ids.includes(edge.to.descriptor.id)
      );

    for (const id of ids) {
      const sourceNode = inspectableGraph.nodeById(id);
      if (!sourceNode) {
        continue;
      }

      const newId = globalThis.crypto.randomUUID();
      remappedIds.set(id, newId);

      const metadata = { ...sourceNode.descriptor.metadata };
      metadata.visual ??= {};

      // Update the positions of each node if needed.
      const visual = metadata.visual as Record<string, number>;
      if (visual.x && this.positionDelta) {
        visual.x += this.positionDelta.x;
        visual.y += this.positionDelta.y;
      }

      // Make a new node with a new ID.
      edits.push({
        type: "addnode",
        graphId: destGraphId ?? "",
        node: {
          id: newId,
          type: sourceNode.descriptor.type,
          metadata,
          configuration: sourceNode.descriptor.configuration,
        },
      });

      // Remove the old one from the source graph.
      edits.push({ type: "removenode", graphId: sourceGraphId, id });
    }

    for (const edge of edgesToRetain) {
      // Now recreate the edges with the remapped IDs.
      const rawEdge = { ...edge.raw() };
      if (!remappedIds.get(rawEdge.from) || !remappedIds.get(rawEdge.to)) {
        continue;
      }

      rawEdge.from = remappedIds.get(rawEdge.from)!;
      rawEdge.to = remappedIds.get(rawEdge.to)!;

      edits.push({
        type: "addedge",
        graphId: destGraphId ?? "",
        edge: rawEdge,
      });
    }

    // Remove any empty graphs.
    // TODO: Decide if this is what we want to do.
    if (
      ids.length === inspectableGraph.nodes().length &&
      sourceGraphId !== ""
    ) {
      edits.push({
        type: "removegraph",
        id: sourceGraphId,
      });
    }

    return context.apply(edits, `Move nodes ${ids.join(", ")}`);
  }
}
