/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  GraphIdentifier,
  InspectableEdge,
  NodeIdentifier,
} from "@google-labs/breadboard";
import {
  GraphSelectionState,
  WorkspaceSelectionChangeId,
  WorkspaceSelectionState,
} from "../types/types";

export function edgeToString(edge: Edge): string {
  return `${edge.from}:${edge.out}->${edge.to}:${edge.in}`;
}

export function inspectableEdgeToString(edge: InspectableEdge): string {
  return edgeToString(edge.raw());
}

export function createNodeId(): NodeIdentifier {
  return globalThis.crypto.randomUUID();
}

export function createGraphId(): GraphIdentifier {
  return globalThis.crypto.randomUUID();
}

export function createWorkspaceSelectionChangeId(): WorkspaceSelectionChangeId {
  return globalThis.crypto.randomUUID();
}

export function createEmptyWorkspaceSelectionState(): WorkspaceSelectionState {
  return {
    graphs: new Map(),
    modules: new Set(),
  };
}

export function createEmptyGraphSelectionState(): GraphSelectionState {
  return {
    nodes: new Set(),
    comments: new Set(),
    edges: new Set(),
  };
}
