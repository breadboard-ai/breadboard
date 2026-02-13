/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditHistoryCreator,
  EditHistoryEntry,
  GraphDescriptor,
  GraphIdentifier,
  ModuleIdentifier,
  MutableGraphStore,
  OutputValues,
} from "@breadboard-ai/types";
import type * as Editor from "../../../controller/subcontrollers/editor/editor.js";

/**
 * Options for initializing the editor.
 */
export interface InitializeEditorOptions {
  /** The prepared graph to edit */
  graph: GraphDescriptor;
  /** The resolved module ID */
  moduleId: ModuleIdentifier | null;
  /** The resolved subgraph ID */
  subGraphId: GraphIdentifier | null;
  /** The URL the graph was loaded from */
  url: string;
  /** Whether the graph is read-only (not owned by current user) */
  readOnly: boolean;
  /** Version information */
  version: number;
  lastLoadedVersion: number;
  /** Creator info for edit history */
  creator?: EditHistoryCreator;
  /** Pre-loaded edit history */
  history?: EditHistoryEntry[];
  /** Callback when history changes */
  onHistoryChanged?: (history: Readonly<EditHistoryEntry[]>) => void;
  /** Pre-loaded final output values */
  finalOutputValues?: OutputValues;
}

/**
 * Result of initializing the editor.
 */
export interface InitializeEditorResult {
  success: true;
  /** The editor ID (for identifying this editing session) */
  id: string;
}

/**
 * Sets up the editor state for a loaded graph.
 *
 * This function:
 * - Sets the graph in the graph store
 * - Creates an editor instance
 * - Wires up event listeners for graph changes
 * - Updates the graph controller state
 *
 * @param graphStore The mutable graph store
 * @param graphController The graph controller to update
 * @param options Editor initialization options
 * @returns The editor ID
 */
export function initializeEditor(
  graphStore: MutableGraphStore,
  graphController: Editor.Graph.GraphController,
  options: InitializeEditorOptions
): InitializeEditorResult {
  const {
    graph,
    url,
    readOnly,
    version,
    lastLoadedVersion,
    creator,
    history,
    onHistoryChanged,
  } = options;

  // Set graph in store
  graphStore.set(graph);

  // Create editor
  const editor = graphStore.edit({
    creator,
    history,
    onHistoryChanged,
  });
  if (!editor) {
    throw new Error("Unable to create editor");
  }

  // Generate a session ID
  const id = globalThis.crypto.randomUUID();

  // Set up controller state
  graphController.id = id;
  graphController.setEditor(editor);
  graphController.url = url;
  graphController.version = version;
  graphController.readOnly = readOnly;
  // Derive graphIsMine from readOnly for legacy compat (deprecated)
  graphController.graphIsMine = !readOnly;
  graphController.mainGraphId = id;
  graphController.lastLoadedVersion = lastLoadedVersion;
  graphController.finalOutputValues = options.finalOutputValues;

  // Bump version to trigger Asset.syncFromGraph and other version-change actions.
  // This must happen AFTER all state is set so triggers see complete state.
  graphController.version++;

  return {
    success: true,
    id,
  };
}

/**
 * Resets the editor state, preparing for a new graph or returning to home.
 *
 * @param graphController The graph controller to reset
 */
export function resetEditor(
  graphController: Editor.Graph.GraphController
): void {
  graphController.resetAll();
}
