/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  EditSpec,
  EditTransform,
  NodeDescriptor,
} from "@breadboard-ai/types";
import { makeAction } from "../binder.js";
import { AddNodeWithEdge } from "../../../ui/transforms/index.js";

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

export async function addNodeWithEdge(
  node: NodeDescriptor,
  edge: Edge,
  subGraphId: string | null = null
) {
  const graphId = subGraphId ?? "";
  const transform = new AddNodeWithEdge(node, edge, graphId);
  return applyInternal(transform);
}
