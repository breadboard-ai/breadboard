/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for Step editing (node configuration in lite mode / sidebar).
 *
 * Note: These actions directly use the editor API rather than importing
 * other action modules, following the SCA pattern of action independence.
 */

import { LLMContent } from "@breadboard-ai/types";
import { ToastType } from "../../../ui/events/events.js";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onSelectionOrSidebarChange } from "./triggers.js";
import { UpdateNode } from "../../../ui/transforms/index.js";
import { UpdateAssetWithRefs } from "../../../ui/transforms/update-asset-with-refs.js";
import { UpdateAssetData } from "../../../ui/transforms/update-asset-data.js";
import { persistDataParts } from "../asset/asset-actions.js";

export const bind = makeAction();

// =============================================================================
// Triggered Actions
// =============================================================================

/**
 * Applies pending node edits when selection or sidebar changes.
 *
 * Key behavior:
 * - Clears pendingEdit BEFORE applying, so if apply fails we don't re-trigger.
 * - Checks graphVersion to detect stale edits. If graph changed since edit
 *   was captured, shows a toast notification and discards the stale edit.
 *
 * **Triggers:**
 * - `onSelectionOrSidebarChange`: Fires when selection or sidebar section changes
 */
export const applyPendingNodeEdit = asAction(
  "Step.applyPendingNodeEdit",
  {
    mode: ActionMode.Immediate,
    priority: 100, // High priority - must run before autosave and other actions
    triggeredBy: () => onSelectionOrSidebarChange(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;

    const pendingEdit = controller.editor.step.pendingEdit;
    if (!pendingEdit) {
      return;
    }

    // Clear BEFORE applying so if apply fails we don't re-trigger
    controller.editor.step.clearPendingEdit();

    const currentVersion = controller.editor.graph.version;
    if (pendingEdit.graphVersion !== currentVersion) {
      // Version mismatch - stale edit, show toast and discard
      controller.global.toasts.toast(
        "Your edits were discarded because the steps changed",
        ToastType.WARNING
      );
      return;
    }

    // Version matches - safe to apply
    const editor = controller.editor.graph.editor;
    if (!editor) {
      return;
    }

    const updateNodeTransform = new UpdateNode(
      pendingEdit.nodeId,
      pendingEdit.graphId,
      pendingEdit.values,
      null, // metadata
      pendingEdit.ins ?? null // portsToAutowire
    );

    await editor.apply(updateNodeTransform);

    // Set the signal so the autoname trigger can react
    controller.editor.graph.lastNodeConfigChange = {
      nodeId: pendingEdit.nodeId,
      graphId: pendingEdit.graphId,
      configuration: pendingEdit.values,
      titleUserModified: updateNodeTransform.titleUserModified,
    };
  }
);

/**
 * Applies pending asset edits when selection or sidebar changes.
 *
 * Key behavior:
 * - Clears pendingAssetEdit BEFORE applying, so if apply fails we don't re-trigger.
 * - Checks graphVersion to detect stale edits. If graph changed since edit
 *   was captured, shows a toast notification and discards the stale edit.
 *
 * **Triggers:**
 * - `onSelectionOrSidebarChange`: Fires when selection or sidebar section changes
 */
export const applyPendingAssetEdit = asAction(
  "Step.applyPendingAssetEdit",
  {
    mode: ActionMode.Immediate,
    priority: 100, // High priority - must run before autosave and other actions
    triggeredBy: () => onSelectionOrSidebarChange(bind),
  },
  async (): Promise<void> => {
    const { controller, services } = bind;

    const pendingAssetEdit = controller.editor.step.pendingAssetEdit;
    if (!pendingAssetEdit) {
      return;
    }

    // Clear BEFORE applying so if apply fails we don't re-trigger
    controller.editor.step.clearPendingAssetEdit();

    const currentVersion = controller.editor.graph.version;
    if (pendingAssetEdit.graphVersion !== currentVersion) {
      // Version mismatch - stale edit, show toast and discard
      controller.global.toasts.toast(
        "Your edits were discarded because the graph changed",
        ToastType.WARNING
      );
      return;
    }

    // Version matches - safe to apply
    const graphController = controller.editor.graph;
    const editor = graphController.editor;
    if (!editor) {
      return;
    }

    // Get current asset to check metadata
    const asset = graphController.graphAssets.get(pendingAssetEdit.assetPath);
    if (!asset?.metadata) {
      console.warn(
        `Graph asset "${pendingAssetEdit.assetPath}" has no metadata, can't update`
      );
      return;
    }

    const metadata = { ...asset.metadata, title: pendingAssetEdit.title };

    // Apply the update to refs
    let result = await editor.apply(
      new UpdateAssetWithRefs(pendingAssetEdit.assetPath, metadata)
    );
    if (!result.success) {
      console.warn(`Failed to update asset refs: ${result.error}`);
      return;
    }

    // If data provided, persist and apply asset data update
    if (pendingAssetEdit.dataPart) {
      const data: LLMContent[] = [
        { role: "user", parts: [pendingAssetEdit.dataPart] },
      ];
      const persistedData = await persistDataParts(
        graphController.url,
        data,
        services.googleDriveBoardServer.dataPartTransformer()
      );

      result = await editor.apply(
        new UpdateAssetData(pendingAssetEdit.assetPath, metadata, persistedData)
      );
      if (!result.success) {
        console.warn(`Failed to update asset data: ${result.error}`);
        return;
      }
    }
  }
);
