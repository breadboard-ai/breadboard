/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types/graph-descriptor.js";
import { signal } from "signal-utils";
import { WorkspaceSelectionState } from "../types/types.js";
import { StepEditor, StepEditorSurface } from "./types.js";

export { StepEditorImpl };

class StepEditorImpl implements StepEditor {
  @signal
  accessor selectedGraph: GraphIdentifier | null = null;

  @signal
  accessor selectedNode: NodeIdentifier | null = null;

  @signal
  accessor surface: StepEditorSurface | null = null;

  updateSelection(selectionState: WorkspaceSelectionState): void {
    // This code is copied with minor modifications from entity-editor.ts.
    // TODO: Reconcile and unify.
    const candidate = [...selectionState.graphs].find(
      ([, graph]) => graph.nodes.size > 0
    );
    if (!candidate) {
      this.selectedNode = null;
      this.selectedGraph = null;
      return;
    }

    const [id, graph] = candidate;
    if (graph.nodes.size) {
      this.selectedNode = [...graph.nodes][0]!;
      this.selectedGraph = id;
    }
  }
}
