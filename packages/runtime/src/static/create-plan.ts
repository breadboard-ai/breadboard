/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  GraphDescriptor,
  OrchestrationPlan,
  PlanNodeInfo,
} from "@breadboard-ai/types";

export { createPlan };

/**
 * Creates an execution plan from the provided GraphDescription.
 * The graph is guaranteed to be condensed (no cycles), and each
 * strongly connected component is represented with a single node
 * that has a "folded" tag.
 */
function createPlan(graph: GraphDescriptor): OrchestrationPlan {
  const { nodes, edges } = graph;

  if (!nodes || nodes.length === 0) {
    return { stages: [] };
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, Edge[]>();
  const inEdges = new Map<string, Edge[]>();

  nodes.forEach((node) => {
    inDegree.set(node.id, 0);
    outEdges.set(node.id, []);
    inEdges.set(node.id, []);
  });

  if (edges) {
    edges.forEach((edge) => {
      const currentDegree = inDegree.get(edge.to) || 0;
      inDegree.set(edge.to, currentDegree + 1);

      const fromEdges = outEdges.get(edge.from) || [];
      fromEdges.push({ ...edge });
      outEdges.set(edge.from, fromEdges);

      const toEdges = inEdges.get(edge.to) || [];
      toEdges.push({ ...edge });
      inEdges.set(edge.to, toEdges);
    });
  }

  const stages: PlanNodeInfo[][] = [];
  const queue = nodes.filter((node) => inDegree.get(node.id) === 0);
  const processed = new Set<string>();

  while (queue.length > 0) {
    const stageNodes: PlanNodeInfo[] = [];
    const nextQueue: typeof queue = [];

    while (queue.length > 0) {
      const node = queue.shift()!;

      if (processed.has(node.id)) continue;
      processed.add(node.id);

      const downstream = outEdges.get(node.id) || [];

      const upstream = inEdges.get(node.id) || [];

      const planNodeInfo: PlanNodeInfo = {
        node: nodeMap.get(node.id)!,
        downstream,
        upstream,
      };
      stageNodes.push(planNodeInfo);

      (outEdges.get(node.id) || []).forEach((edge) => {
        const targetDegree = inDegree.get(edge.to) || 0;
        if (targetDegree > 0) {
          inDegree.set(edge.to, targetDegree - 1);
          if (targetDegree === 1) {
            const targetNode = nodeMap.get(edge.to);
            if (targetNode) nextQueue.push(targetNode);
          }
        }
      });
    }

    if (stageNodes.length > 0) {
      stages.push(stageNodes);
    }

    queue.push(...nextQueue);
  }

  return { stages };
}
