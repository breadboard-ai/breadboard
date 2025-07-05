/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";

export { condense };

// Given a GraphDescriptor, creates another GraphDescriptor that is a
// condensed graph representation of it.
// All strongly connected components of the graph are replaced with nodes
// whose types point at subgraphs, like this "#<id of subgraph>".
// The subgraph is created as follows:
// - a node of type "input" is created, and this node acts as a way to
//   capture all incoming edge ports (the "in" values), so that they
//   are correctly routed to inside of the subgraph
// - a node of type "output" is created, and this node acts as a way to
//   capture all outgoing edge ports (the "out" values), so that they
//   are correctly routed from the subgraph to.
// In effect, the input/output nodes in a subgraph act as a
// "function signature" of the subgraph.
// See https://en.wikipedia.org/wiki/Strongly_connected_component for
// discussion and definitions.
function condense(graph: GraphDescriptor): GraphDescriptor {
  if (!graph.nodes || !graph.edges) {
    return graph;
  }

  // Find strongly connected components using Tarjan's algorithm
  const sccs = findStronglyConnectedComponents(graph);

  // If no SCCs found, return original graph
  if (sccs.length === 0) {
    return graph;
  }

  // Create condensed graph
  return createCondensedGraph(graph, sccs);
}

interface TarjanState {
  index: number;
  lowlink: number;
  onStack: boolean;
}

function findStronglyConnectedComponents(graph: GraphDescriptor): string[][] {
  const nodeStates = new Map<string, TarjanState>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let index = 0;

  function strongConnect(nodeId: string) {
    // Set the depth index for this node
    nodeStates.set(nodeId, {
      index: index,
      lowlink: index,
      onStack: true,
    });
    index++;
    stack.push(nodeId);

    // Consider successors of this node
    const outgoingEdges =
      graph.edges?.filter((edge) => edge.from === nodeId) || [];
    for (const edge of outgoingEdges) {
      const successorId = edge.to;
      const successorState = nodeStates.get(successorId);

      if (!successorState) {
        // Successor has not yet been visited; recurse on it
        strongConnect(successorId);
        const currentState = nodeStates.get(nodeId)!;
        const updatedSuccessorState = nodeStates.get(successorId)!;
        currentState.lowlink = Math.min(
          currentState.lowlink,
          updatedSuccessorState.lowlink
        );
      } else if (successorState.onStack) {
        // Successor is in stack and hence in the current SCC
        const currentState = nodeStates.get(nodeId)!;
        currentState.lowlink = Math.min(
          currentState.lowlink,
          successorState.index
        );
      }
    }

    // If this is a root node, pop the stack and create an SCC
    const currentState = nodeStates.get(nodeId)!;
    if (currentState.lowlink === currentState.index) {
      const scc: string[] = [];
      let poppedNode: string;
      do {
        poppedNode = stack.pop()!;
        const poppedState = nodeStates.get(poppedNode)!;
        poppedState.onStack = false;
        scc.push(poppedNode);
      } while (poppedNode !== nodeId);
      sccs.push(scc);
    }
  }

  // Start DFS from all unvisited nodes
  for (const node of graph.nodes || []) {
    if (!nodeStates.has(node.id)) {
      strongConnect(node.id);
    }
  }

  // Filter out trivial SCCs (single nodes with no self-loops)
  return sccs.filter((scc) => {
    if (scc.length > 1) return true;
    // Check if single node has self-loop
    const nodeId = scc[0];
    return (
      graph.edges?.some((edge) => edge.from === nodeId && edge.to === nodeId) ||
      false
    );
  });
}

function createCondensedGraph(
  graph: GraphDescriptor,
  sccs: string[][]
): GraphDescriptor {
  const condensedGraph: GraphDescriptor = {
    ...graph,
    nodes: [...(graph.nodes || [])],
    edges: [...(graph.edges || [])],
    graphs: { ...(graph.graphs || {}) },
  };

  // Create map from node ID to SCC index
  const nodeToSccMap = new Map<string, number>();
  sccs.forEach((scc, index) => {
    scc.forEach((nodeId) => {
      nodeToSccMap.set(nodeId, index);
    });
  });

  // Process each SCC
  sccs.forEach((scc, sccIndex) => {
    const subgraphId = `scc_${sccIndex}`;
    const subgraph = createSubgraphFromSCC(graph, scc, subgraphId);

    // Add subgraph to graphs collection
    condensedGraph.graphs![subgraphId] = subgraph;

    // Create condensed node to replace SCC
    const condensedNodeId = `condensed_${sccIndex}`;
    const condensedNode = {
      id: condensedNodeId,
      type: `#${subgraphId}`,
      metadata: {
        title: `Condensed SCC ${sccIndex}`,
        description: `Strongly connected component with ${scc.length} nodes`,
      },
    };

    // Replace SCC nodes with condensed node
    condensedGraph.nodes =
      condensedGraph.nodes?.filter((node) => !scc.includes(node.id)) || [];
    condensedGraph.nodes.push(condensedNode);

    // Update edges to point to/from condensed node
    updateEdgesForCondensedNode(condensedGraph, scc, condensedNodeId);
  });

  return condensedGraph;
}

function createSubgraphFromSCC(
  graph: GraphDescriptor,
  scc: string[],
  subgraphId: string
): GraphDescriptor {
  // Find all edges within the SCC
  const internalEdges =
    graph.edges?.filter(
      (edge) => scc.includes(edge.from) && scc.includes(edge.to)
    ) || [];

  // Find incoming edges to the SCC
  const incomingEdges =
    graph.edges?.filter(
      (edge) => !scc.includes(edge.from) && scc.includes(edge.to)
    ) || [];

  // Find outgoing edges from the SCC
  const outgoingEdges =
    graph.edges?.filter(
      (edge) => scc.includes(edge.from) && !scc.includes(edge.to)
    ) || [];

  // Get nodes in the SCC
  const sccNodes = graph.nodes?.filter((node) => scc.includes(node.id)) || [];

  // Create input node for capturing incoming edges
  const inputNode = {
    id: "input",
    type: "input",
    metadata: {
      title: "SCC Input",
      description:
        "Captures incoming edges to the strongly connected component",
    },
  };

  // Create output node for capturing outgoing edges
  const outputNode = {
    id: "output",
    type: "output",
    metadata: {
      title: "SCC Output",
      description:
        "Captures outgoing edges from the strongly connected component",
    },
  };

  // Create subgraph edges
  const subgraphEdges = [...internalEdges];

  // Add edges from input node to SCC entry points
  incomingEdges.forEach((edge) => {
    subgraphEdges.push({
      from: "input",
      to: edge.to,
      in: edge.in,
      out: edge.in || "out",
    });
  });

  // Add edges from SCC exit points to output node
  outgoingEdges.forEach((edge) => {
    subgraphEdges.push({
      from: edge.from,
      to: "output",
      in: edge.out || "in",
      out: edge.out,
    });
  });

  return {
    title: `SCC Subgraph ${subgraphId}`,
    description: `Subgraph containing strongly connected component`,
    nodes: [inputNode, ...sccNodes, outputNode],
    edges: subgraphEdges,
  };
}

function updateEdgesForCondensedNode(
  condensedGraph: GraphDescriptor,
  scc: string[],
  condensedNodeId: string
) {
  if (!condensedGraph.edges) return;

  // Update edges that cross SCC boundaries
  condensedGraph.edges = condensedGraph.edges
    .map((edge) => {
      const fromInScc = scc.includes(edge.from);
      const toInScc = scc.includes(edge.to);

      if (fromInScc && !toInScc) {
        // Outgoing edge from SCC
        return { ...edge, from: condensedNodeId };
      } else if (!fromInScc && toInScc) {
        // Incoming edge to SCC
        return { ...edge, to: condensedNodeId };
      }
      return edge;
    })
    .filter((edge) => {
      // Remove internal SCC edges (they're now in the subgraph)
      return !(scc.includes(edge.from) && scc.includes(edge.to));
    });
}
