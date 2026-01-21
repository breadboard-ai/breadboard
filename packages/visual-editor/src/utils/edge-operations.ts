/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Edge } from "@breadboard-ai/types/graph-descriptor.js";

export { computeEdgeDiff, dedupeEdges };

function dedupeEdges(edges: Edge[]) {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = edgeKey(edge);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeEdgeDiff(current: Edge[], incoming: Edge[]) {
  const currentMap = new Map<string, Edge>();
  const incomingMap = new Map<string, Edge>();

  current.forEach((edge) => {
    currentMap.set(edgeKey(edge), edge);
  });
  incoming.forEach((edge) => {
    incomingMap.set(edgeKey(edge), edge);
  });

  const toDelete: Edge[] = [];
  const toInsert: Edge[] = [];

  current.forEach((edge) => {
    const key = edgeKey(edge);
    if (!incomingMap.has(key)) {
      toDelete.push(edge);
    }
  });

  incoming.forEach((edge) => {
    const key = edgeKey(edge);
    if (!currentMap.has(key)) {
      toInsert.push(edge);
    }
  });

  return { toInsert, toDelete };
}

function edgeKey({ metadata: _m, ...rest }: Edge) {
  return JSON.stringify(rest);
}