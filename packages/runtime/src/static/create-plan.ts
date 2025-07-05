/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { ExecutionPlan, PlanStage, PlanNodeInfo } from "./types.js";

export { createPlan };

/**
 * Creates an execution plan from the provided GraphDescription.
 * The graph is guaranteed to be condensed (no cycles), and each
 * strongly connected component is represented with a single node
 * that has a "folded" tag.
 */
function createPlan(graph: GraphDescriptor): ExecutionPlan {
  const { nodes, edges } = graph;
  
  if (!nodes || nodes.length === 0) {
    return { stages: [] };
  }

  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, Array<{ to: string; out?: string; in?: string }>>();
  const inEdges = new Map<string, Array<{ from: string; out?: string; in?: string }>>();

  nodes.forEach(node => {
    inDegree.set(node.id, 0);
    outEdges.set(node.id, []);
    inEdges.set(node.id, []);
  });

  if (edges) {
    edges.forEach(edge => {
      const currentDegree = inDegree.get(edge.to) || 0;
      inDegree.set(edge.to, currentDegree + 1);
      
      const fromEdges = outEdges.get(edge.from) || [];
      fromEdges.push({ to: edge.to, out: edge.out, in: edge.in });
      outEdges.set(edge.from, fromEdges);
      
      const toEdges = inEdges.get(edge.to) || [];
      toEdges.push({ from: edge.from, out: edge.out, in: edge.in });
      inEdges.set(edge.to, toEdges);
    });
  }

  const stages: PlanStage[] = [];
  const queue = nodes.filter(node => inDegree.get(node.id) === 0);
  const processed = new Set<string>();

  while (queue.length > 0) {
    const stageNodes: PlanNodeInfo[] = [];
    const nextQueue: typeof queue = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      
      if (processed.has(node.id)) continue;
      processed.add(node.id);

      const downstream = (outEdges.get(node.id) || []).map(edge => ({
        to: createPlanNodeInfo(edge.to, outEdges, inEdges),
        out: edge.out || ""
      }));

      const upstream = (inEdges.get(node.id) || []).map(edge => ({
        from: createPlanNodeInfo(edge.from, outEdges, inEdges),
        in: edge.in || ""
      }));

      const planNodeInfo: PlanNodeInfo = {
        id: node.id,
        downstream,
        upstream
      };

      if (node.metadata?.tags?.includes("folded")) {
        stages.push({
          type: "vm",
          node: planNodeInfo
        });
      } else {
        stageNodes.push(planNodeInfo);
      }

      (outEdges.get(node.id) || []).forEach(edge => {
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
      stages.push({
        type: "static",
        nodes: stageNodes
      });
    }

    queue.push(...nextQueue);
  }

  return { stages };
}

function createPlanNodeInfo(nodeId: string, outEdges: Map<string, Array<{ to: string; out?: string; in?: string }>>, inEdges: Map<string, Array<{ from: string; out?: string; in?: string }>>): PlanNodeInfo {
  const downstream = (outEdges.get(nodeId) || []).map(edge => ({
    to: { id: edge.to, downstream: [], upstream: [] } as PlanNodeInfo,
    out: edge.out || ""
  }));

  const upstream = (inEdges.get(nodeId) || []).map(edge => ({
    from: { id: edge.from, downstream: [], upstream: [] } as PlanNodeInfo,
    in: edge.in || ""
  }));

  return {
    id: nodeId,
    downstream,
    upstream
  };
}
