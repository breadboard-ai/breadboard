/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { nodesToSubgraph } from "./nodes-to-subgraph.js";

export { condense };

/**
 * Given a GraphDescriptor, creates another GraphDescriptor that is a
 * condensed graph representation of it.
 * All strongly connected components (SCC) of the graph are replaced with nodes
 * whose types point at subgraphs, like this "#<id of subgraph>".
 * The subgraph is created as follows:
 * - a node of type "input" is created, and this node acts as a way to
 *   capture all incoming edge ports (the "in" values), so that they
 *   are correctly routed to inside of the subgraph
 * - a node of type "output" is created, and this node acts as a way to
 *   capture all outgoing edge ports (the "out" values), so that they
 *   are correctly routed from the subgraph to.
 * In effect, the input/output nodes in a subgraph act as a
 * "function signature" of the subgraph.
 * See https://en.wikipedia.org/wiki/Strongly_connected_component for
 * discussion and definitions.
 */
function condense(graph: GraphDescriptor): GraphDescriptor {
  if (!graph.nodes || !graph.edges) {
    return graph;
  }

  const sccs = findStronglyConnectedComponents(graph);

  if (sccs.length === 0) {
    return graph;
  }
  return createCondensedGraph(graph, sccs);
}

type TarjanState = {
  index: number;
  lowlink: number;
  onStack: boolean;
};

/**
 * Finds all strongly connected components (SCCs) in a directed graph.
 *
 * @param graph - The graph to analyze, represented as a GraphDescriptor.
 * @returns An array of strongly connected components, where each component is represented as an array of node IDs.
 */
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
    nodesToSubgraph(
      condensedGraph,
      scc,
      subgraphId,
      `SCC Subgraph ${subgraphId}`,
      "Subgraph containing strongly connected component"
    );
  });

  return condensedGraph;
}
