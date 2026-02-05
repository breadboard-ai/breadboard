/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for Step editing (node configuration in lite mode / sidebar).
 */

import { LLMContent } from "@breadboard-ai/types";
import { ToastType } from "../../../ui/events/events.js";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onSelectionOrSidebarChange } from "./triggers.js";
import * as Graph from "../graph/graph-actions.js";

export const bind = makeAction();

// =============================================================================
// Actions
// =============================================================================

/**
 * Applies pending step edits when selection or sidebar changes.
 *
 * This replaces the manual save logic in canvas-controller willUpdate.
 *
 * Key behavior:
 * - Clears pendingEdit BEFORE applying, so if apply fails we don't re-trigger.
 * - Checks graphVersion to detect stale edits. If graph changed since edit
 *   was captured (e.g. user typed then dragged a wire), shows a toast
 *   notification and discards the stale edit.
 *
 * **Triggers:**
 * - `onSelectionOrSidebarChange`: Fires when selection or sidebar section changes
 */
export const applyPendingEdits = asAction(
  "Step.applyPendingEdits",
  {
    mode: ActionMode.Immediate,
    priority: 100, // High priority - must run before autosave and other actions
    triggeredBy: () => onSelectionOrSidebarChange(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;

    // Read pending edits (these should be set since the trigger fired)
    const pendingEdit = controller.editor.step.pendingEdit;
    const pendingAssetEdit = controller.editor.step.pendingAssetEdit;

    // Current graph version
    const currentVersion = controller.editor.graph.version;

    // Handle node edit
    if (pendingEdit) {
      // Clear BEFORE applying so if apply fails we don't re-trigger
      controller.editor.step.clearPendingEdit();

      if (pendingEdit.graphVersion === currentVersion) {
        // Version matches - safe to apply
        await Graph.changeNodeConfiguration(
          pendingEdit.nodeId,
          pendingEdit.graphId,
          pendingEdit.values
        );
      } else {
        // Version mismatch - stale edit, show toast and discard
        controller.global.toasts.toast(
          "Your edits were discarded because the steps changed",
          ToastType.WARNING
        );
      }
    }

    // Handle asset edit
    if (pendingAssetEdit) {
      controller.editor.step.clearPendingAssetEdit();

      if (pendingAssetEdit.graphVersion === currentVersion) {
        // Version matches - safe to apply
        let data: LLMContent[] | undefined = undefined;
        if (pendingAssetEdit.dataPart) {
          data = [{ role: "user", parts: [pendingAssetEdit.dataPart] }];
        }

        await pendingAssetEdit.update(pendingAssetEdit.title, data);
      } else {
        // Version mismatch - stale edit, show toast and discard
        controller.global.toasts.toast(
          "Your edits were discarded because the graph changed",
          ToastType.WARNING
        );
      }
    }
  }
);
