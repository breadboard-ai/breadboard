/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  EditableGraphSelectionResult,
  InspectableGraph,
  NodeIdentifier,
} from "@breadboard-ai/types";

export { computeSelection };

/**
 * Creates a selection: a list of nodes and edges that will are associated
 * with the given list of node identifiers within the graph.
 * The selection is transient in that it only applies to the current version
 * of the graph and becomes invalid as soon as the graph mutates.
 *
 * @param nodes -- nodes to include in the selection
 */
function computeSelection(
  graph: InspectableGraph,
  nodes: NodeIdentifier[]
): EditableGraphSelectionResult {
  // First, let's make sure that all nodes are present in graph.
  const allPresent = nodes.every((id) => graph.nodeById(id));
  if (!allPresent) {
    return {
      success: false,
      error: "Can't create selection: some nodes aren't in the graph",
    };
  }
  // Now, let's get all the edges connected to these nodes.
  const n = new Set(nodes);
  const edges: Edge[] = [];
  const dangling: Edge[] = [];
  graph.raw().edges.forEach((edge) => {
    const { from, to } = edge;
    const hasFrom = n.has(from);
    const hasTo = n.has(to);
    if (hasFrom && hasTo) {
      edges.push(edge);
    } else if (hasFrom || hasTo) {
      dangling.push(edge);
    }
  });

  return {
    success: true,
    nodes,
    edges,
    dangling,
  };
}
