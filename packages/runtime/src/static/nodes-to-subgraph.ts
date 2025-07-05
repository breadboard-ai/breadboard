/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphIdentifier,
  NodeDescriptor,
  NodeIdentifier,
} from "@breadboard-ai/types";

export { nodesToSubgraph };

/**
 * Moves a group of nodes within a graph into a subgraph, mutating
 * the supplied graph.
 *
 * @param graph - The graph where the subgraph will be created.
 * @param nodeGroup - The group of nodes to include in the subgraph.
 * @param subgraphId - The unique identifier for the subgraph.
 * @param title - An optional title for the subgraph.
 * @param description - An optional description for the subgraph.
 */
function nodesToSubgraph(
  graph: GraphDescriptor,
  nodeGroup: NodeIdentifier[],
  subgraphId: GraphIdentifier,
  title?: string,
  description?: string
) {
  // Find all edges within the node group
  const subgraph = createSubgraph(
    graph,
    nodeGroup,
    subgraphId,
    title,
    description
  );

  graph.graphs ??= {};
  graph.graphs[subgraphId] = subgraph;

  const replacementNodeId = subgraphId;
  const replacementNode: NodeDescriptor = {
    id: replacementNodeId,
    type: `#${subgraphId}`,
    metadata: {
      title: `Subgraph "${subgraphId}"`,
      tags: ["folded"],
    },
  };

  // Replace folded nodes with a replacement
  graph.nodes =
    graph.nodes?.filter((node) => !nodeGroup.includes(node.id)) || [];
  graph.nodes.push(replacementNode);

  // Update edges to point to/from condensed node
  updateEdgeForFoldedNode(graph, nodeGroup, replacementNodeId);
}

function createSubgraph(
  graph: GraphDescriptor,
  nodeGroup: NodeIdentifier[],
  subgraphId: GraphIdentifier,
  title?: string,
  description?: string
): GraphDescriptor {
  const internalEdges =
    graph.edges?.filter(
      (edge) => nodeGroup.includes(edge.from) && nodeGroup.includes(edge.to)
    ) || [];

  // Find incoming edges to the node group
  const incomingEdges =
    graph.edges?.filter(
      (edge) => !nodeGroup.includes(edge.from) && nodeGroup.includes(edge.to)
    ) || [];

  // Find outgoing edges from the node group
  const outgoingEdges =
    graph.edges?.filter(
      (edge) => nodeGroup.includes(edge.from) && !nodeGroup.includes(edge.to)
    ) || [];

  // Get nodes in the group
  const groupNodes =
    graph.nodes?.filter((node) => nodeGroup.includes(node.id)) || [];

  // Create input node for capturing incoming edges
  const inputNode: NodeDescriptor = {
    id: "input",
    type: "input",
    metadata: {
      title: "Subgraph Input",
      description: "Captures incoming edges to the subgraph",
    },
  };

  // Create output node for capturing outgoing edges
  const outputNode: NodeDescriptor = {
    id: "output",
    type: "output",
    metadata: {
      title: "Subgraph Output",
      description: "Captures outgoing edges from the subgraph",
    },
  };

  // Create subgraph edges
  const subgraphEdges = [...internalEdges];

  // Add edges from input node to group entry points
  incomingEdges.forEach((edge) => {
    subgraphEdges.push({
      from: "input",
      to: edge.to,
      in: edge.in,
      out: edge.in || "out",
    });
  });

  // Add edges from group exit points to output node
  outgoingEdges.forEach((edge) => {
    subgraphEdges.push({
      from: edge.from,
      to: "output",
      in: edge.out || "in",
      out: edge.out,
    });
  });

  return {
    title: title || `Subgraph ${subgraphId}`,
    description: description || `Subgraph containing ${nodeGroup.length} nodes`,
    nodes: [inputNode, ...groupNodes, outputNode],
    edges: subgraphEdges,
  };
}

function updateEdgeForFoldedNode(
  graph: GraphDescriptor,
  nodeGroup: string[],
  nodeId: string
) {
  if (!graph.edges) return;

  // Update edges that cross fold lines
  graph.edges = graph.edges
    .map((edge) => {
      const from = nodeGroup.includes(edge.from);
      const into = nodeGroup.includes(edge.to);

      if (from && !into) {
        return { ...edge, from: nodeId };
      } else if (!from && into) {
        return { ...edge, to: nodeId };
      }
      return edge;
    })
    // Remove internal edges (they're now in the subgraph)
    .filter((edge) => {
      return !(nodeGroup.includes(edge.from) && nodeGroup.includes(edge.to));
    });
}
