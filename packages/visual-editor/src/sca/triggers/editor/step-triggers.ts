/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import { Signal } from "signal-polyfill";
import { ToastType } from "../../../ui/events/events.js";
import { makeTrigger } from "../binder.js";

export const bind = makeTrigger();

/**
 * Trigger that saves pending step edits when selection or sidebar changes.
 *
 * This replaces the manual save logic in canvas-controller willUpdate.
 * Uses Signal.subtle.untrack to read pendingEdit without establishing
 * a dependency, so the trigger only fires on selection/sidebar changes
 * and not when pendingEdit itself changes.
 *
 * Key behavior:
 * - Clears pendingEdit BEFORE applying, so if apply fails we don't re-trigger.
 * - Checks graphVersion to detect stale edits. If graph changed since edit
 *   was captured (e.g. user typed then dragged a wire), shows a toast
 *   notification and discards the stale edit.
 */
export function registerStepAutoSaveTrigger() {
  bind.register("Step Auto Save Trigger", async () => {
    const { controller, actions } = bind;

    // These reads register the dependencies - the trigger will
    // re-run when these change
    const selectionId = controller.editor.selection.selectionId;
    const sidebarSection = controller.editor.sidebar.section;

    // Prevent lint warning about unused variable - we need to read
    // these to establish the dependency
    void selectionId;
    void sidebarSection;

    // Read pending edits WITHOUT registering as dependency.
    // This is the key trick - we want to save when selection/sidebar
    // changes, but not when pendingEdit changes.
    const pendingEdit = Signal.subtle.untrack(() =>
      controller.editor.step.pendingEdit
    );
    const pendingAssetEdit = Signal.subtle.untrack(() =>
      controller.editor.step.pendingAssetEdit
    );

    // Current graph version
    const currentVersion = controller.editor.graph.version;

    // Handle node edit
    if (pendingEdit) {
      // Clear BEFORE applying so if apply fails we don't re-trigger
      controller.editor.step.clearPendingEdit();

      if (pendingEdit.graphVersion === currentVersion) {
        // Version matches - safe to apply
        await actions.graph.changeNodeConfiguration(
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
  });
}
