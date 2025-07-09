/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Edge, GraphDescriptor } from "@breadboard-ai/types";

export { willCreateCycle };

/**
 * Determines if adding the given edge to the graph will create a cycle.
 * 
 * @param edge - The edge to be added to the graph
 * @param graph - The graph to check for cycles
 * @returns true if adding the edge will create a cycle, false otherwise
 */
function willCreateCycle(edge: Edge, graph: GraphDescriptor): boolean {
  if (!graph.nodes || !graph.edges) {
    return false;
  }

  // Check if the edge already exists
  const edgeExists = graph.edges.some(
    (e) => e.from === edge.from && e.to === edge.to
  );
  if (edgeExists) {
    return false; // Edge already exists, no new cycle created
  }

  // Check if both nodes exist in the graph
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
    return false; // Missing nodes, cannot create cycle
  }

  // Self-loop always creates a cycle
  if (edge.from === edge.to) {
    return true;
  }

  // Check if there's already a path from edge.to to edge.from
  // If so, adding edge.from -> edge.to would create a cycle
  return hasPath(graph, edge.to, edge.from);
}

/**
 * Checks if there's a path from source to target in the graph using DFS.
 * 
 * @param graph - The graph to search in
 * @param source - The source node
 * @param target - The target node
 * @returns true if a path exists, false otherwise
 */
function hasPath(graph: GraphDescriptor, source: string, target: string): boolean {
  if (source === target) {
    return true;
  }

  const visited = new Set<string>();
  const stack = [source];

  while (stack.length > 0) {
    const current = stack.pop()!;
    
    if (visited.has(current)) {
      continue;
    }
    
    visited.add(current);
    
    if (current === target) {
      return true;
    }

    // Find all outgoing edges from current node
    const outgoingEdges = graph.edges?.filter((edge) => edge.from === current) || [];
    
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.to)) {
        stack.push(edge.to);
      }
    }
  }

  return false;
}