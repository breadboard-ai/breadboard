/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { ExecutionPlan, PlanStage } from "./types.js";

export { createPlan };

/**
 * Creates an execution plan from the provided GraphDescription.
 * The graph is guaranteed to be condensed (no cycles), and each
 * strongly connected component is represented with a single node
 * that has a "folded" tag.
 */
function createPlan(graph: GraphDescriptor): ExecutionPlan {
  if (!graph.nodes || graph.nodes.length === 0) {
    return { stages: [] };
  }

  const stages: PlanStage[] = [];
  const visited = new Set<string>();
  const dependencies = new Map<string, Set<string>>();
  const reverseDependencies = new Map<string, Set<string>>();

  // Build dependency graph
  for (const node of graph.nodes) {
    dependencies.set(node.id, new Set());
    reverseDependencies.set(node.id, new Set());
  }

  for (const edge of graph.edges || []) {
    const fromNode = edge.from;
    const toNode = edge.to;

    if (dependencies.has(toNode) && reverseDependencies.has(fromNode)) {
      dependencies.get(toNode)!.add(fromNode);
      reverseDependencies.get(fromNode)!.add(toNode);
    }
  }

  // Create execution stages using topological sort
  while (visited.size < graph.nodes.length) {
    const readyNodes: string[] = [];

    // Find nodes with no unvisited dependencies
    for (const node of graph.nodes) {
      if (visited.has(node.id)) continue;

      const nodeDeps = dependencies.get(node.id) || new Set();
      const unvisitedDeps = Array.from(nodeDeps).filter(
        (dep) => !visited.has(dep)
      );

      if (unvisitedDeps.length === 0) {
        readyNodes.push(node.id);
      }
    }

    if (readyNodes.length === 0) {
      // This shouldn't happen in a condensed graph (no cycles)
      throw new Error(
        "Cannot create execution plan: graph contains cycles or unresolvable dependencies"
      );
    }

    // Separate regular nodes from VM nodes (folded SCCs)
    const regularNodes: string[] = [];
    const vmNodes: string[] = [];

    for (const nodeId of readyNodes) {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (node?.metadata?.tags?.includes("folded")) {
        vmNodes.push(nodeId);
      } else {
        regularNodes.push(nodeId);
      }
    }

    // Create stages for regular nodes (can be executed in parallel)
    if (regularNodes.length > 0) {
      stages.push({
        type: "static",
        nodes: regularNodes,
      });
    }

    // Create individual VM stages (must be executed sequentially)
    for (const vmNodeId of vmNodes) {
      stages.push({
        type: "vm",
        node: vmNodeId,
      });
    }

    // Mark all ready nodes as visited
    for (const nodeId of readyNodes) {
      visited.add(nodeId);
    }
  }

  return { stages };
}
