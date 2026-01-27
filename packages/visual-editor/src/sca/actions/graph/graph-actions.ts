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
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
  NodeMetadata,
} from "@breadboard-ai/types";
import { makeAction } from "../binder.js";
import {
  ChangeAssetEdge,
  ChangeEdge,
  ChangeEdgeAttachmentPoint,
  UpdateNode,
} from "../../../ui/transforms/index.js";
import type { InPort } from "../../../ui/transforms/autowire-in-ports.js";
import type { SelectionPositionUpdate } from "../../../ui/events/node/node.js";
import type { AssetEdge, EdgeAttachmentPoint } from "../../../ui/types/types.js";

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
 *
 *
 */

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

export async function undo() {
  const { controller } = bind;
  const history = controller.editor.graph.editor?.history();
  if (!history || !history.canUndo()) return;
  return history.undo();
}

export async function redo() {
  const { controller } = bind;
  const history = controller.editor.graph.editor?.history();
  if (!history || !history.canRedo()) return;
  return history.redo();
}

export async function updateBoardTitleAndDescription(
  title: string | null,
  description: string | null
) {
  return editInternal(
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

export async function changeEdge(
  changeType: "add" | "remove" | "move",
  from: Edge,
  to?: Edge,
  subGraphId: string | null = null
) {
  const graphId = subGraphId ?? "";
  const transform = new ChangeEdge(changeType, graphId, from, to);
  return applyInternal(transform);
}

/**
 * Changes a node's configuration and sets the lastNodeConfigChange signal
 * to trigger autonaming as a side effect.
 */
export async function changeNodeConfiguration(
  id: NodeIdentifier,
  graphId: GraphIdentifier,
  configurationPart: NodeConfiguration,
  metadata: NodeMetadata | null = null,
  portsToAutowire: InPort[] | null = null
) {
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

/**
 * Adds a single node to the graph.
 */
export function addNode(node: NodeDescriptor, graphId: GraphIdentifier) {
  return editInternal(
    [{ type: "addnode", graphId, node }],
    `Add step: ${node.metadata?.title ?? node.id}`
  );
}

/**
 * Updates the positions of selected nodes and assets.
 */
export function moveSelectionPositions(updates: SelectionPositionUpdate[]) {
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

  return editInternal(edits, "Update selection position");
}

/**
 * Changes an asset edge (add or remove).
 */
export function changeAssetEdge(
  changeType: "add" | "remove",
  edge: AssetEdge,
  subGraphId: string | null = null
) {
  const graphId = subGraphId ?? "";
  const transform = new ChangeAssetEdge(changeType, graphId, edge);
  return applyInternal(transform);
}

/**
 * Changes an edge attachment point.
 */
export function changeEdgeAttachmentPoint(
  graphId: GraphIdentifier,
  edge: Edge,
  which: "from" | "to",
  attachmentPoint: EdgeAttachmentPoint
) {
  const transform = new ChangeEdgeAttachmentPoint(graphId, edge, which, attachmentPoint);
  return applyInternal(transform);
}

/**
 * Replaces the entire graph with a new graph descriptor.
 */
export function replace(
  replacement: GraphDescriptor,
  creator: EditHistoryCreator
) {
  return editInternal(
    [{ type: "replacegraph", replacement, creator }],
    "Replace graph"
  );
}
