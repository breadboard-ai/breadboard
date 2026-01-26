/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditSpec } from "@breadboard-ai/types";
import { makeAction } from "../binder.js";

export const bind = makeAction();

export async function edit(spec: EditSpec[], label: string, dryRun = false) {
  const { controller, services } = bind;
  const { graph } = controller.editor.graph;

  if (!graph) {
    console.warn("No active graph to edit");
    return;
  }

  const editor = services.graphStore.editByDescriptor(graph);
  if (!editor) {
    console.warn("Unable to create editor for graph");
    return;
  }

  const result = await editor.edit(spec, label, dryRun);
  if (!result.success) {
    throw new Error("Unable to edit graph");
  }

  console.log("Commit graph action");

  return result;
}
