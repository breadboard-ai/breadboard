/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  GraphDescriptor,
  NodeDescriptor,
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
  const entries = nodes.filter((node) => inDegree.get(node.id) === 0);

  // Now, let's separate out all standalone steps and see if maybe we only
  // have standalone nodes.
  const standalone: NodeDescriptor[] = [];
  const connected: NodeDescriptor[] = [];
  let onlyStandalone = true;
  entries.forEach((node) => {
    const nodeTails = outEdges.get(node.id) || [];
    if (nodeTails.length == 0) {
      standalone.push(node);
    } else {
      onlyStandalone = false;
      connected.push(node);
    }
  });
  let queue: NodeDescriptor[];

  // If there are no standalone nodes, return all entries as usual.
  if (standalone.length === 0) {
    queue = entries;
  } else if (onlyStandalone) {
    // This is the situation when we have a bunch of random nodes in graph
    // and they are not connected, and there's no designated start node.

    // Just return the first standalone node.
    queue = [standalone[0]];
  } else {
    // If there are both standalone and connected nodes, we just ignore
    // all standalone nodes.
    queue = connected;
  }

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
