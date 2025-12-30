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
import {
  FastAccess,
  ProjectValues,
  StepEditor,
  StepEditorSurface,
} from "./types.js";
import { ReactiveFastAccess } from "./fast-access.js";
import { FilteredIntegrationsImpl } from "./filtered-integrations.js";
import { MAIN_BOARD_ID } from "../constants/constants.js";

export { StepEditorImpl };

class StepEditorImpl implements StepEditor {
  @signal
  accessor nodeSelection: {
    graph: GraphIdentifier;
    node: NodeIdentifier;
  } | null = null;

  @signal
  accessor surface: StepEditorSurface | null = null;

  fastAccess: FastAccess;

  constructor(projectValues: ProjectValues) {
    const {
      graphAssets,
      tools,
      myTools,
      controlFlowTools,
      components,
      parameters,
      integrations,
      editable,
    } = projectValues;
    this.fastAccess = new ReactiveFastAccess(
      graphAssets,
      tools,
      myTools,
      controlFlowTools,
      components,
      parameters,
      new FilteredIntegrationsImpl(integrations.registered),
      editable,
      this
    );
  }

  updateSelection(selectionState: WorkspaceSelectionState): void {
    // This code is copied with minor modifications from entity-editor.ts.
    // TODO: Reconcile and unify.
    const candidate = [...selectionState.graphs].find(
      ([, graph]) => graph.nodes.size > 0
    );
    if (!candidate) {
      this.nodeSelection = null;
      return;
    }

    const [id, graph] = candidate;

    if (graph.nodes.size) {
      this.nodeSelection = {
        graph: id === MAIN_BOARD_ID ? "" : id,
        node: [...graph.nodes][0]!,
      };
    }
  }
}
