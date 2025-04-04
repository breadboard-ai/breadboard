/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphIdentifier,
  ModuleIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { RuntimeSelectionChangeEvent } from "./events";
import {
  GraphSelectionState,
  TabId,
  WorkspaceSelectionChangeId,
  TabSelectionState,
  WorkspaceSelectionState,
  MoveToSelection,
} from "./types";
import { InspectableGraph } from "@google-labs/breadboard";
import {
  createEmptyGraphSelectionState,
  createEmptyWorkspaceSelectionState,
  inspectableEdgeToString,
  isBoardArrayBehavior,
  isBoardBehavior,
  MAIN_BOARD_ID,
} from "./util";

export class Select extends EventTarget {
  #selectionState: TabSelectionState = new Map<
    TabId,
    WorkspaceSelectionState
  >();

  #createWorkspaceSelectionStateIfNeeded(tab: TabId): WorkspaceSelectionState {
    let state = this.#selectionState.get(tab);
    if (!state) {
      state = createEmptyWorkspaceSelectionState();
      this.#selectionState.set(tab, state);
    }

    return state;
  }

  #createGraphSelectionStateIfNeeded(
    selectionState: WorkspaceSelectionState,
    graphId: GraphIdentifier
  ): GraphSelectionState {
    let graphSelection = selectionState.graphs.get(graphId);
    if (!graphSelection) {
      graphSelection = createEmptyGraphSelectionState();
      selectionState.graphs.set(graphId, graphSelection);
    }

    return graphSelection;
  }

  #clear(tab: TabId) {
    this.#selectionState.set(tab, createEmptyWorkspaceSelectionState());
  }

  #emit(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    moveToSelection: MoveToSelection = false
  ) {
    const state = this.#createWorkspaceSelectionStateIfNeeded(tab);
    this.dispatchEvent(
      new RuntimeSelectionChangeEvent(selectionChangeId, state, moveToSelection)
    );
  }

  #graphCollection<T extends keyof GraphSelectionState>(
    tab: TabId,
    graphId: GraphIdentifier,
    namespace: T
  ) {
    const selection = this.#createWorkspaceSelectionStateIfNeeded(tab);
    const graphSelection = this.#createGraphSelectionStateIfNeeded(
      selection,
      graphId
    );

    return graphSelection[namespace] as GraphSelectionState[T] extends Set<
      infer U
    >
      ? Set<U>
      : never;
  }

  #addToModulesCollection(tab: TabId, moduleId: ModuleIdentifier) {
    const selection = this.#createWorkspaceSelectionStateIfNeeded(tab);
    selection.modules.add(moduleId);
  }

  #removeFromModulesCollection(tab: TabId, moduleId: ModuleIdentifier) {
    const selection = this.#createWorkspaceSelectionStateIfNeeded(tab);
    selection.modules.delete(moduleId);
  }

  #addToGraphsCollection<T extends keyof GraphSelectionState>(
    tab: TabId,
    graphId: GraphIdentifier,
    namespace: T,
    value: GraphSelectionState[T] extends Set<infer U> ? U : never
  ) {
    const namespaceCollection = this.#graphCollection(tab, graphId, namespace);
    namespaceCollection.add(value);
  }

  #removeFromGraphsCollection<T extends keyof GraphSelectionState>(
    tab: TabId,
    graphId: GraphIdentifier,
    namespace: T,
    value: GraphSelectionState[T] extends Set<infer U> ? U : never
  ) {
    const namespaceCollection = this.#graphCollection(tab, graphId, namespace);
    namespaceCollection.delete(value);
  }

  generateId(): WorkspaceSelectionChangeId {
    return crypto.randomUUID();
  }

  addNode(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ) {
    this.#addToGraphsCollection(tab, graphId, "nodes", nodeId);
    this.#emit(tab, selectionChangeId);
  }

  removeNode(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ) {
    this.#removeFromGraphsCollection(tab, graphId, "nodes", nodeId);
    this.#emit(tab, selectionChangeId);
  }

  addComment(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    graphId: GraphIdentifier,
    commentId: string
  ) {
    this.#addToGraphsCollection(tab, graphId, "comments", commentId);
    this.#emit(tab, selectionChangeId);
  }

  removeComment(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    graphId: GraphIdentifier,
    commentId: string
  ) {
    this.#removeFromGraphsCollection(tab, graphId, "comments", commentId);
    this.#emit(tab, selectionChangeId);
  }

  addEdge(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    graphId: GraphIdentifier,
    edgeId: string
  ) {
    this.#addToGraphsCollection(tab, graphId, "edges", edgeId);
    this.#emit(tab, selectionChangeId);
  }

  removeEdge(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    graphId: GraphIdentifier,
    edgeId: string
  ) {
    this.#removeFromGraphsCollection(tab, graphId, "edges", edgeId);
    this.#emit(tab, selectionChangeId);
  }

  addModule(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    moduleId: ModuleIdentifier
  ) {
    this.#addToModulesCollection(tab, moduleId);
    this.#emit(tab, selectionChangeId);
  }

  removeModule(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    moduleId: ModuleIdentifier
  ) {
    this.#removeFromModulesCollection(tab, moduleId);
    this.#emit(tab, selectionChangeId);
  }

  processSelections(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    selections: WorkspaceSelectionState | null,
    replaceExistingSelections = true,
    moveToSelection: MoveToSelection = false
  ) {
    if (selections === null) {
      this.#clear(tab);
      this.#emit(tab, selectionChangeId);
      return;
    }

    if (replaceExistingSelections) {
      this.#clear(tab);
    }

    for (const [id, selectionState] of selections.graphs) {
      // Ensure that the workspace and graph selection states exist, even if
      // the contents of the selection state are empty.
      const workspaceState = this.#createWorkspaceSelectionStateIfNeeded(tab);
      this.#createGraphSelectionStateIfNeeded(workspaceState, id);

      for (const nodes of selectionState.nodes) {
        this.#addToGraphsCollection(tab, id, "nodes", nodes);
      }

      for (const comments of selectionState.comments) {
        this.#addToGraphsCollection(tab, id, "comments", comments);
      }

      for (const edges of selectionState.edges) {
        this.#addToGraphsCollection(tab, id, "edges", edges);
      }

      for (const references of selectionState.references) {
        this.#addToGraphsCollection(tab, id, "references", references);
      }

      for (const assets of selectionState.assets) {
        this.#addToGraphsCollection(tab, id, "assets", assets);
      }

      for (const assetEdges of selectionState.assetEdges) {
        this.#addToGraphsCollection(tab, id, "assetEdges", assetEdges);
      }
    }

    for (const id of selections.modules) {
      this.#addToModulesCollection(tab, id);
    }

    this.#emit(tab, selectionChangeId, moveToSelection);
  }

  selectNode(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ) {
    this.#clear(tab);
    this.#addToGraphsCollection(tab, graphId, "nodes", nodeId);
    this.#emit(tab, selectionChangeId);
  }

  selectNodes(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    graphId: GraphIdentifier,
    nodeIds: NodeIdentifier[]
  ) {
    this.#clear(tab);
    for (const nodeId of nodeIds) {
      this.#addToGraphsCollection(tab, graphId, "nodes", nodeId);
    }
    this.#emit(tab, selectionChangeId);
  }

  selectAll(
    tab: TabId,
    selectionChangeId: WorkspaceSelectionChangeId,
    graph: InspectableGraph
  ) {
    if (!tab) {
      return;
    }

    const workspaceSelections: WorkspaceSelectionState =
      createEmptyWorkspaceSelectionState();

    const createSelection = (graph: InspectableGraph) => {
      const selections: GraphSelectionState = createEmptyGraphSelectionState();
      for (const node of graph.nodes()) {
        selections.nodes.add(node.descriptor.id);

        const referencePorts = node
          .currentPorts()
          .inputs.ports.filter(
            (port) =>
              isBoardBehavior(port.schema) || isBoardArrayBehavior(port.schema)
          );

        for (const port of referencePorts) {
          if (Array.isArray(port.value)) {
            for (let i = 0; i < port.value.length; i++) {
              selections.references.add(
                `${node.descriptor.id}|${port.name}|${i}`
              );
            }
          } else {
            selections.references.add(`${node.descriptor.id}|${port.name}|0`);
          }
        }
      }

      for (const edge of graph.edges()) {
        selections.edges.add(inspectableEdgeToString(edge));
      }

      for (const comment of graph.metadata()?.comments ?? []) {
        selections.comments.add(comment.id);
      }

      for (const asset of (graph.assets() ?? new Map()).keys()) {
        selections.comments.add(asset);
      }

      return selections;
    };

    workspaceSelections.graphs.set(MAIN_BOARD_ID, createSelection(graph));
    for (const [id, subGraph] of Object.entries(graph.graphs() || {})) {
      workspaceSelections.graphs.set(id, createSelection(subGraph));
    }

    this.processSelections(tab, selectionChangeId, workspaceSelections);
  }

  deselectAll(tab: TabId, selectionChangeId: WorkspaceSelectionChangeId) {
    this.#clear(tab);
    this.#emit(tab, selectionChangeId);
  }

  refresh(tab: TabId, selectionChangeId: WorkspaceSelectionChangeId) {
    this.#emit(tab, selectionChangeId);
  }
}
