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
} from "./types.js";
import { ReactiveFastAccess } from "./fast-access.js";
import { FilteredIntegrationsImpl } from "./filtered-integrations.js";
import { MAIN_BOARD_ID } from "../constants/constants.js";
import { SCA } from "../../sca/sca.js";

export { StepEditorImpl };

class StepEditorImpl implements StepEditor {
  @signal
  accessor nodeSelection: {
    graph: GraphIdentifier;
    node: NodeIdentifier;
  } | null = null;

  fastAccess: FastAccess;

  #sca: SCA;

  constructor(projectValues: ProjectValues, sca: SCA) {
    this.#sca = sca;
    const {
      graphAssets,
      myTools,
      agentModeTools,
      components,
      integrations,
      editable,
    } = projectValues;
    const tools = sca.controller.editor.graph.tools;
    this.fastAccess = new ReactiveFastAccess(
      graphAssets,
      tools,
      myTools,
      agentModeTools,
      components,
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

  /**
   * Applies any pending edits via the SCA step autosave action.
   * This is used when we need to ensure pending edits are applied
   * before running an action (e.g., running a node), since the
   * SCA trigger only fires on selection/sidebar changes.
   */
  async applyPendingEdits(): Promise<void> {
    await this.#sca.actions.step.applyPendingEdits();
  }
}

