/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Edge, NodeIdentifier, InputValues } from "../types.js";

interface TraversalEdge {
  from: NodeIdentifier;
  to: NodeIdentifier;
  out: string;
  in: string;
  required?: boolean;
}

interface NodeState {
  inputs: InputValues;
  receivedEdges: Set<string>;
}

export class Traversal {
  private incomingEdges: Map<NodeIdentifier, TraversalEdge[]> = new Map();
  private nodeStates: Map<NodeIdentifier, NodeState> = new Map();
  
  constructor(edges: Edge[]) {
    for (const edge of edges) {
      const edgesForNode = this.incomingEdges.get(edge.to) || [];
      edgesForNode.push(edge as TraversalEdge);
      this.incomingEdges.set(edge.to, edgesForNode);
    }
  }
  
  /**
   * Check if a node is ready to execute.
   * A node is ready only when all required incoming edges have provided data.
   */
  isNodeReady(nodeId: NodeIdentifier): boolean {
    const edges = this.incomingEdges.get(nodeId) || [];
    const state = this.nodeStates.get(nodeId);
    
    for (const edge of edges) {
      if (edge.required) {
        const edgeKey = `${edge.from}:${edge.out}`;
        if (!state?.receivedEdges.has(edgeKey)) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Receive data from an edge.
   */
  receiveEdgeData(nodeId: NodeIdentifier, from: NodeIdentifier, out: string, data: unknown): void {
    let state = this.nodeStates.get(nodeId);
    if (!state) {
      state = { inputs: {}, receivedEdges: new Set() };
      this.nodeStates.set(nodeId, state);
    }
    
    state.receivedEdges.add(`${from}:${out}`);
    
    if (data !== undefined && typeof data === "object") {
      Object.assign(state.inputs, data);
    }
  }
  
  getNodeInputs(nodeId: NodeIdentifier): InputValues {
    return this.nodeStates.get(nodeId)?.inputs || {};
  }
}