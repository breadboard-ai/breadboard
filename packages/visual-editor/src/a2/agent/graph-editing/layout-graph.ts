/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Edge, NodeDescriptor } from "@breadboard-ai/types";
import { changeNodeConfiguration } from "../../../sca/actions/graph/graph-actions.js";

export { layoutGraph, computePositions };

const HORIZONTAL_SPACING = 400;
const VERTICAL_SPACING = 200;

/**
 * Automatically position all nodes in the graph based on DAG topology.
 *
 * Algorithm:
 * 1. Compute depth for each node: depth = max(depth(parent) + 1), roots = 0
 * 2. x = depth × HORIZONTAL_SPACING
 * 3. Within each depth, stack nodes vertically: y = index × VERTICAL_SPACING
 * 4. Update each node's visual metadata
 */
async function layoutGraph(
  nodes: NodeDescriptor[],
  edges: Edge[]
): Promise<void> {
  const positions = computePositions(nodes, edges);

  for (const [nodeId, { x, y }] of positions) {
    await changeNodeConfiguration(nodeId, "", {}, { visual: { x, y } });
  }
}

/**
 * Compute node positions from the graph's DAG topology.
 */
function computePositions(
  nodes: NodeDescriptor[],
  edges: Edge[]
): Map<string, { x: number; y: number }> {
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Build adjacency: parent → children
  const incomingEdges = new Map<string, string[]>();
  for (const id of nodeIds) {
    incomingEdges.set(id, []);
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    incomingEdges.get(edge.to)!.push(edge.from);
  }

  // Compute depth via BFS (longest path from any root)
  const depth = new Map<string, number>();
  const roots = [...nodeIds].filter(
    (id) => incomingEdges.get(id)!.length === 0
  );

  // Initialize all to 0
  for (const id of nodeIds) {
    depth.set(id, 0);
  }

  // Topological relaxation: propagate depths
  // Process in topological order via Kahn's algorithm
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const id of nodeIds) {
    inDegree.set(id, incomingEdges.get(id)!.length);
    children.set(id, []);
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    children.get(edge.from)!.push(edge.to);
  }

  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of children.get(current) ?? []) {
      const newDepth = depth.get(current)! + 1;
      if (newDepth > depth.get(child)!) {
        depth.set(child, newDepth);
      }
      const remaining = inDegree.get(child)! - 1;
      inDegree.set(child, remaining);
      if (remaining === 0) {
        queue.push(child);
      }
    }
  }

  // Group nodes by depth
  const byDepth = new Map<number, string[]>();
  for (const [id, d] of depth) {
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(id);
  }

  // Assign positions
  const positions = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of byDepth) {
    // Center the column vertically around y=0
    const totalHeight = (ids.length - 1) * VERTICAL_SPACING;
    const startY = -totalHeight / 2;
    for (let i = 0; i < ids.length; i++) {
      positions.set(ids[i], {
        x: d * HORIZONTAL_SPACING,
        y: startY + i * VERTICAL_SPACING,
      });
    }
  }

  return positions;
}
