/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetMetadata,
  Edge,
  EditHistoryCreator,
  EditSpec,
  EditTransform,
  GraphDescriptor,
  GraphIdentifier,
  GraphMetadata,
  GraphTheme,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
  NodeMetadata,
} from "@breadboard-ai/types";
import type { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onPendingGraphReplacement } from "./triggers.js";
import {
  ChangeAssetEdge,
  ChangeEdge,
  ChangeEdgeAttachmentPoint,
  UpdateNode,
} from "../../../ui/transforms/index.js";
import type { InPort } from "../../../ui/transforms/autowire-in-ports.js";
import type { SelectionPositionUpdate } from "../../../ui/events/node/node.js";
import type {
  AssetEdge,
  EdgeAttachmentPoint,
} from "../../../ui/types/types.js";

export const bind = makeAction();

/**
 * @fileoverview
 *
 * Contains Actions for editing graphs.
 *
 * Note: Currently these Actions does not require the graphStore service because
 * we keep the editor instance on the graphController. This is so that it is a
 * stable reference on which we can listen to legacy events. However, the aim is
 * to remove events in favor of Signals, which, when complete, will mean that
 * edits can get a fresh editor from the graphStore service here.
 */

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Runs a generic edit.
 */
async function editInternal(spec: EditSpec[], label: string, dryRun = false) {
  const { controller } = bind;

  // TODO: Get the editor instance from the graphStore service. Note that the
  // edit event fired by the editor instance here will be picked up and routed
  // through the Runtime so that main-base picks it up and triggers an autosave.
  const { editor } = controller.editor.graph;
  if (!editor) {
    throw new Error("No active graph to edit");
  }

  const result = await editor.edit(spec, label, dryRun);
  if (result.success) {
    return;
  }

  throw new Error("Unable to edit graph");
}

async function applyInternal(transform: EditTransform) {
  const { controller } = bind;

  // TODO: Get the editor instance from the graphStore service. Note that the
  // edit event fired by the editor instance here will be picked up and routed
  // through the Runtime so that main-base picks it up and triggers an autosave.
  const { editor } = controller.editor.graph;
  if (!editor) {
    throw new Error("No active graph to transform");
  }

  const result = await editor.apply(transform);
  if (result.success) {
    return;
  }

  throw new Error(result.error);
}

// =============================================================================
// Actions
// =============================================================================

/**
 * Undoes the last edit operation.
 */
export const undo = asAction(
  "Graph.undo",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const history = controller.editor.graph.editor?.history();
    if (!history || !history.canUndo()) return;
    await history.undo();
  }
);

/**
 * Redoes the last undone edit operation.
 */
export const redo = asAction(
  "Graph.redo",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const history = controller.editor.graph.editor?.history();
    if (!history || !history.canRedo()) return;
    await history.redo();
  }
);

/**
 * Updates the board's title and description.
 */
export const updateBoardTitleAndDescription = asAction(
  "Graph.updateBoardTitleAndDescription",
  { mode: ActionMode.Immediate },
  async (title: string | null, description: string | null): Promise<void> => {
    await editInternal(
      [
        {
          type: "changegraphmetadata",
          title: title ?? undefined,
          description: description ?? undefined,
          graphId: "",
        },
      ],
      "Updating title and description"
    );
  }
);

/**
 * Changes an edge (add, remove, or move).
 */
export const changeEdge = asAction(
  "Graph.changeEdge",
  { mode: ActionMode.Immediate },
  async (
    changeType: "add" | "remove" | "move",
    from: Edge,
    to?: Edge,
    subGraphId: string | null = null
  ): Promise<void> => {
    const graphId = subGraphId ?? "";
    const transform = new ChangeEdge(changeType, graphId, from, to);
    await applyInternal(transform);
  }
);

/**
 * Changes a node's configuration and sets the lastNodeConfigChange signal
 * to trigger autonaming as a side effect.
 */
export const changeNodeConfiguration = asAction(
  "Graph.changeNodeConfiguration",
  { mode: ActionMode.Immediate },
  async (
    id: NodeIdentifier,
    graphId: GraphIdentifier,
    configurationPart: NodeConfiguration,
    metadata: NodeMetadata | null = null,
    portsToAutowire: InPort[] | null = null
  ): Promise<void> => {
    const updateNodeTransform = new UpdateNode(
      id,
      graphId,
      configurationPart,
      metadata,
      portsToAutowire
    );

    await applyInternal(updateNodeTransform);

    const { controller } = bind;

    // Set the signal so the autoname trigger can react.
    controller.editor.graph.lastNodeConfigChange = {
      nodeId: id,
      graphId,
      configuration: configurationPart,
      titleUserModified: updateNodeTransform.titleUserModified,
    };
  }
);

/**
 * Adds a single node to the graph.
 */
export const addNode = asAction(
  "Graph.addNode",
  { mode: ActionMode.Immediate },
  async (node: NodeDescriptor, graphId: GraphIdentifier): Promise<void> => {
    await editInternal(
      [{ type: "addnode", graphId, node }],
      `Add step: ${node.metadata?.title ?? node.id}`
    );
  }
);

/**
 * Updates the positions of selected nodes and assets.
 */
export const moveSelectionPositions = asAction(
  "Graph.moveSelectionPositions",
  { mode: ActionMode.Immediate },
  async (updates: SelectionPositionUpdate[]): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;
    if (!editor) {
      throw new Error("No active graph to edit");
    }

    const edits: EditSpec[] = [];

    for (const update of updates) {
      if (update.type === "node") {
        // Fetch existing metadata from editor, merge visual coordinates
        const inspector = editor.inspect(update.graphId);
        const node = inspector.nodeById(update.id);
        const existingMetadata = node?.metadata() ?? {};
        const existingVisual = (existingMetadata.visual ?? {}) as Record<
          string,
          unknown
        >;
        const metadata: NodeMetadata = {
          ...existingMetadata,
          visual: { ...existingVisual, x: update.x, y: update.y },
        };
        edits.push({
          type: "changemetadata",
          id: update.id,
          graphId: update.graphId,
          metadata,
        });
      } else {
        // Asset position update
        const graph = editor.raw();
        const asset = graph.assets?.[update.id];
        if (!asset?.metadata) {
          continue;
        }
        const metadata: AssetMetadata = {
          ...asset.metadata,
          visual: { x: update.x, y: update.y },
        };
        edits.push({
          type: "changeassetmetadata",
          path: update.id,
          metadata,
        });
      }
    }

    await editInternal(edits, "Update selection position");
  }
);

/**
 * Changes an asset edge (add or remove).
 */
export const changeAssetEdge = asAction(
  "Graph.changeAssetEdge",
  { mode: ActionMode.Immediate },
  async (
    changeType: "add" | "remove",
    edge: AssetEdge,
    subGraphId: string | null = null
  ): Promise<void> => {
    const graphId = subGraphId ?? "";
    const transform = new ChangeAssetEdge(changeType, graphId, edge);
    await applyInternal(transform);
  }
);

/**
 * Changes an edge attachment point.
 */
export const changeEdgeAttachmentPoint = asAction(
  "Graph.changeEdgeAttachmentPoint",
  { mode: ActionMode.Immediate },
  async (
    graphId: GraphIdentifier,
    edge: Edge,
    which: "from" | "to",
    attachmentPoint: EdgeAttachmentPoint
  ): Promise<void> => {
    const transform = new ChangeEdgeAttachmentPoint(
      graphId,
      edge,
      which,
      attachmentPoint
    );
    await applyInternal(transform);
  }
);

/**
 * Replaces the entire graph with a new graph descriptor.
 */
export const replace = asAction(
  "Graph.replace",
  { mode: ActionMode.Immediate },
  async (
    replacement: GraphDescriptor,
    creator: EditHistoryCreator
  ): Promise<void> => {
    await editInternal(
      [{ type: "replacegraph", replacement, creator }],
      "Replace graph"
    );
  }
);

export interface ReplaceWithThemeOptions {
  /** The replacement graph (will be mutated to apply theme) */
  replacement: GraphDescriptor;
  /** Optional theme to apply to the graph */
  theme?: GraphTheme;
  /** Edit history creator info */
  creator: EditHistoryCreator;
  /** Google Drive client for palette creation when no theme provided */
  googleDriveClient?: GoogleDriveClient | null;
}

/**
 * Replaces the entire graph with full theme handling.
 *
 * This action handles:
 * 1. Applying a generated theme if provided
 * 2. Falling back to default theme application if no theme (requires googleDriveClient)
 * 3. Preserving splash screen from current graph's theme if replacement lacks one
 *
 * **Triggered** by setting `controller.editor.graph.pendingGraphReplacement`.
 * Can also be called directly with options for non-triggered usage.
 */
export const replaceWithTheme = asAction(
  "Graph.replaceWithTheme",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () => onPendingGraphReplacement(bind),
  },
  async (options?: ReplaceWithThemeOptions): Promise<void> => {
    const { controller } = bind;

    // When triggered (no options), read from controller state
    const pendingReplacement = controller.editor.graph.pendingGraphReplacement;
    const effectiveOptions = options ?? pendingReplacement;

    // Clear pending BEFORE applying (so if apply fails we don't re-trigger)
    controller.editor.graph.clearPendingGraphReplacement();

    // Guard: no options from either source
    if (!effectiveOptions) {
      return;
    }

    const { replacement, theme, creator } = effectiveOptions;

    // 1. Apply theme if provided
    if (theme) {
      const metadata: GraphMetadata = (replacement.metadata ??= {});
      metadata.visual ??= {};
      metadata.visual.presentation ??= {};
      metadata.visual.presentation.themes ??= {};

      const id = globalThis.crypto.randomUUID();
      metadata.visual.presentation.themes[id] = theme;
      metadata.visual.presentation.theme = id;
    }

    // 2. Preserve splash screen from current theme if replacement doesn't have one
    // TODO: Remove this when the Planner persists the existing theme.
    const currentGraph = controller.editor.graph.editor?.raw();
    if (currentGraph) {
      const currentPresentation = currentGraph.metadata?.visual?.presentation;
      const currentTheme = currentPresentation?.theme;
      const currentThemes = currentPresentation?.themes;
      const currentThemeHasSplashScreen =
        currentTheme &&
        currentThemes &&
        currentThemes[currentTheme] &&
        currentThemes[currentTheme].splashScreen;

      const replacementPresentation =
        replacement.metadata?.visual?.presentation;
      const replacementTheme = replacementPresentation?.theme;
      const replacementThemes = replacementPresentation?.themes;
      const replacementThemeHasSplashScreen =
        replacementTheme &&
        replacementThemes &&
        replacementThemes[replacementTheme] &&
        replacementThemes[replacementTheme].splashScreen;

      if (currentThemeHasSplashScreen && !replacementThemeHasSplashScreen) {
        console.log("[graph replacement] Persisting existing theme");
        replacementThemes![replacementTheme!] = currentThemes![currentTheme!];
      }
    }

    // 3. Replace the graph
    await replace(replacement, creator);

    // 4. Clear flowgenInput now that the graph is populated. This is done
    // here (not in the generate action) to prevent a flash: the generate
    // action sets pendingGraphReplacement and this trigger fires async.
    // If flowgenInput were cleared in generate, there'd be a render cycle
    // where isGenerating=false but the graph is still empty → shows "home".
    controller.global?.flowgenInput?.clear();
  }
);
