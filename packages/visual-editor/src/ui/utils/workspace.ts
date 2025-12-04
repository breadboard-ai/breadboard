/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  GraphIdentifier,
  InspectableAssetEdge,
  InspectableEdge,
  InspectableGraph,
  NodeIdentifier,
} from "@google-labs/breadboard";
import {
  GraphHighlightState,
  GraphSelectionState,
  HighlightState,
  WorkspaceSelectionChangeId,
  WorkspaceSelectionState,
} from "../types/types";
import { MAIN_BOARD_ID } from "../constants/constants";
import { ModuleIdentifier } from "@breadboard-ai/types";
import { isBoardArrayBehavior, isBoardBehavior } from "./behaviors.js";

export function edgeToString(edge: Edge): string {
  return `${edge.from}:${edge.out}->${edge.to}:${edge.in}`;
}

export function inspectableEdgeToString(edge: InspectableEdge): string {
  return edgeToString(edge.raw());
}

export function inspectableAssetEdgeToString(
  edge: InspectableAssetEdge
): string {
  return `${edge.assetPath}->${edge.node.descriptor.id}:${edge.direction}`;
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

export function createHighlightId(): ReturnType<
  typeof globalThis.crypto.randomUUID
> {
  return globalThis.crypto.randomUUID();
}

export function createEmptyHighlightState(): HighlightState {
  return {
    graphs: new Map(),
  };
}

export function createEmptyGraphSelectionState(): GraphSelectionState {
  return {
    nodes: new Set(),
    assets: new Set(),
    assetEdges: new Set(),
    comments: new Set(),
    edges: new Set(),
    references: new Set(),
  };
}

export function createEmptyGraphHighlightState(): GraphHighlightState {
  return {
    nodes: new Set(),
    comments: new Set(),
    edges: new Set(),
  };
}

export function createSelection(
  existingSelectionState: WorkspaceSelectionState | null,
  targetGraph: InspectableGraph | undefined | null,
  subGraphId: GraphIdentifier | null,
  moduleId: ModuleIdentifier | null,
  nodeId: NodeIdentifier | null = null,
  replaceExistingSelections = true
) {
  const subGraph = subGraphId ? subGraphId : MAIN_BOARD_ID;
  let selectionState: WorkspaceSelectionState;

  // Either start with an empty selection or the existing selection.
  if (!existingSelectionState || replaceExistingSelections) {
    selectionState = createEmptyWorkspaceSelectionState();
  } else {
    selectionState = existingSelectionState;
  }

  // If there's a subgraph ID and it doesn't already exist in the selection
  // then go ahead and add it.
  if (subGraphId && !selectionState.graphs.has(subGraphId)) {
    selectionState.graphs.set(subGraphId, createEmptyGraphSelectionState());
  } else if (!subGraphId && !selectionState.graphs.has(MAIN_BOARD_ID)) {
    selectionState.graphs.set(MAIN_BOARD_ID, createEmptyGraphSelectionState());
  }

  // Similarly for the module ID.
  if (moduleId && !selectionState.modules.has(moduleId)) {
    selectionState.graphs.clear();
    selectionState.modules.clear();
    selectionState.modules.add(moduleId);
  } else if (!moduleId && replaceExistingSelections) {
    selectionState.modules.clear();
  }

  if (!moduleId) {
    const graphSelection = selectionState.graphs.get(subGraph);
    if (graphSelection && nodeId) {
      if (graphSelection.nodes.has(nodeId) && replaceExistingSelections) {
        graphSelection.nodes.delete(nodeId);
      } else {
        graphSelection.nodes.add(nodeId);
      }
    } else if (graphSelection) {
      // Append all nodes.
      if (targetGraph && subGraph !== MAIN_BOARD_ID) {
        targetGraph = targetGraph.graphs()?.[subGraph];
      }

      if (targetGraph) {
        for (const node of targetGraph.nodes()) {
          graphSelection.nodes.add(node.descriptor.id);

          const referencePorts = node
            .currentPorts()
            .inputs.ports.filter(
              (port) =>
                isBoardBehavior(port.schema) ||
                isBoardArrayBehavior(port.schema)
            );

          for (const port of referencePorts) {
            if (Array.isArray(port.value)) {
              for (let i = 0; i < port.value.length; i++) {
                graphSelection.references.add(
                  `${node.descriptor.id}|${port.name}|${i}`
                );
              }
            } else {
              graphSelection.references.add(
                `${node.descriptor.id}|${port.name}|0`
              );
            }
          }
        }

        for (const edge of targetGraph.edges()) {
          graphSelection.edges.add(inspectableEdgeToString(edge));
        }

        for (const comment of targetGraph.metadata()?.comments || []) {
          graphSelection.comments.add(comment.id);
        }
      }
    }
  }

  return selectionState;
}
