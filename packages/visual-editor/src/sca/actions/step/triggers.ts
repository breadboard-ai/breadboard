/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Step actions.
 */

import { Signal } from "signal-polyfill";
import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import { type ActionBind } from "../binder.js";

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when selection or sidebar section changes.
 *
 * Uses Signal.subtle.untrack to read pendingEdit without establishing a
 * dependency - we only want to fire when selection/sidebar changes, not
 * when the pending edit itself changes.
 *
 * Returns true when there are pending edits to apply.
 */
export function onSelectionOrSidebarChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Selection/Sidebar Change", () => {
    const { controller } = bind;

    // These reads register the dependencies - the trigger will
    // re-run when these change
    const selectionId = controller.editor.selection.selectionId;
    const sidebarSection = controller.editor.sidebar.section;

    // Prevent lint warning about unused variable
    void selectionId;
    void sidebarSection;

    // Read pending edits WITHOUT registering as dependency
    const pendingEdit = Signal.subtle.untrack(
      () => controller.editor.step.pendingEdit
    );
    const pendingAssetEdit = Signal.subtle.untrack(
      () => controller.editor.step.pendingAssetEdit
    );

    // Return true if there are pending edits
    return !!(pendingEdit || pendingAssetEdit);
  });
}

/**
 * Creates a trigger that fires when a node action is requested.
 *
 * Pre-action orchestration: when a node action is requested, pending
 * step edits must be applied before the action can proceed. This trigger
 * watches the nodeActionRequest field and returns true when there is both
 * a pending action request AND pending edits to apply.
 */
export function onNodeActionRequested(bind: ActionBind): SignalTrigger {
  return signalTrigger("Node Action Requested (Step)", () => {
    const { controller } = bind;

    // Register dependency on the action request
    const request = controller.run.main.nodeActionRequest;

    // Read pending edits WITHOUT registering as dependency
    const pendingEdit = Signal.subtle.untrack(
      () => controller.editor.step.pendingEdit
    );
    const pendingAssetEdit = Signal.subtle.untrack(
      () => controller.editor.step.pendingAssetEdit
    );

    // Fire when there's a request AND pending edits
    return !!(request && (pendingEdit || pendingAssetEdit));
  });
}
