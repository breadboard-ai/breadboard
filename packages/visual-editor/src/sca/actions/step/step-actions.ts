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
import { ToastType } from "../../types.js";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import {
  onSelectionOrSidebarChange,
  onNodeActionRequested,
} from "./triggers.js";
import { UpdateNode } from "../../../ui/transforms/index.js";
import { UpdateAssetWithRefs } from "../../../ui/transforms/update-asset-with-refs.js";
import { UpdateAssetData } from "../../../ui/transforms/update-asset-data.js";
import { persistDataParts } from "../../utils/persist-data-parts.js";
import { Utils } from "../../utils.js";

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
    const LABEL = "Step.applyPendingAssetEdit";
    const logger = Utils.Logging.getLogger(controller);

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
      logger.log(
        Utils.Logging.Formatter.warning(
          `Graph asset "${pendingAssetEdit.assetPath}" has no metadata, can't update`
        ),
        LABEL
      );
      return;
    }

    const metadata = { ...asset.metadata, title: pendingAssetEdit.title };

    // Persist data BEFORE applying any transforms to avoid flicker
    // where syncFromGraph fires with old data.
    let persistedData: LLMContent[] | undefined;
    if (pendingAssetEdit.dataPart) {
      const data: LLMContent[] = [
        { role: "user", parts: [pendingAssetEdit.dataPart] },
      ];
      persistedData = await persistDataParts(
        graphController.url,
        data,
        services.googleDriveBoardServer.dataPartTransformer()
      );
    }

    // When data is provided, apply UpdateAssetData FIRST so that the
    // graph descriptor has the new data before any syncFromGraph fires.
    if (persistedData) {
      let result = await editor.apply(
        new UpdateAssetData(pendingAssetEdit.assetPath, metadata, persistedData)
      );
      if (!result.success) {
        logger.log(
          Utils.Logging.Formatter.warning(
            `Failed to update asset data: ${result.error}`
          ),
          LABEL
        );
        return;
      }

      result = await editor.apply(
        new UpdateAssetWithRefs(pendingAssetEdit.assetPath, metadata)
      );
      if (!result.success) {
        logger.log(
          Utils.Logging.Formatter.warning(
            `Failed to update asset refs: ${result.error}`
          ),
          LABEL
        );
        return;
      }
    } else {
      // No data change, just update refs
      const result = await editor.apply(
        new UpdateAssetWithRefs(pendingAssetEdit.assetPath, metadata)
      );
      if (!result.success) {
        logger.log(
          Utils.Logging.Formatter.warning(
            `Failed to update asset refs: ${result.error}`
          ),
          LABEL
        );
        return;
      }
    }
  }
);

// =============================================================================
// Pre-action Orchestration
// =============================================================================

/**
 * Applies pending node and asset edits when a node action is requested.
 *
 * This is the pre-action orchestration step: before executeNodeAction
 * (in run-actions) dispatches the run/stop command, any pending step
 * edits must be flushed first.
 *
 * **Triggers:**
 * - `onNodeActionRequested`: Fires when nodeActionRequest is set AND
 *   there are pending edits.
 */
export const applyPendingEditsForNodeAction = asAction(
  "Step.applyPendingEditsForNodeAction",
  {
    mode: ActionMode.Immediate,
    priority: 100, // Must run before executeNodeAction (priority 50)
    triggeredBy: () => onNodeActionRequested(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;

    // Apply pending node edit
    const pendingEdit = controller.editor.step.pendingEdit;
    if (pendingEdit) {
      controller.editor.step.clearPendingEdit();

      const currentVersion = controller.editor.graph.version;
      if (pendingEdit.graphVersion !== currentVersion) {
        controller.global.toasts.toast(
          "Your edits were discarded because the steps changed",
          ToastType.WARNING
        );
      } else {
        const editor = controller.editor.graph.editor;
        if (editor) {
          const updateNodeTransform = new UpdateNode(
            pendingEdit.nodeId,
            pendingEdit.graphId,
            pendingEdit.values,
            null,
            pendingEdit.ins ?? null
          );
          await editor.apply(updateNodeTransform);
          controller.editor.graph.lastNodeConfigChange = {
            nodeId: pendingEdit.nodeId,
            graphId: pendingEdit.graphId,
            configuration: pendingEdit.values,
            titleUserModified: updateNodeTransform.titleUserModified,
          };
        }
      }
    }

    // Apply pending asset edit
    const pendingAssetEdit = controller.editor.step.pendingAssetEdit;
    if (pendingAssetEdit) {
      controller.editor.step.clearPendingAssetEdit();

      const currentVersion = controller.editor.graph.version;
      if (pendingAssetEdit.graphVersion !== currentVersion) {
        controller.global.toasts.toast(
          "Your edits were discarded because the graph changed",
          ToastType.WARNING
        );
      } else {
        const graphController = controller.editor.graph;
        const editor = graphController.editor;
        if (editor) {
          const { services } = bind;
          const asset = graphController.graphAssets.get(
            pendingAssetEdit.assetPath
          );
          if (asset?.metadata) {
            const metadata = {
              ...asset.metadata,
              title: pendingAssetEdit.title,
            };

            let persistedData: LLMContent[] | undefined;
            if (pendingAssetEdit.dataPart) {
              const data: LLMContent[] = [
                { role: "user", parts: [pendingAssetEdit.dataPart] },
              ];
              persistedData = await persistDataParts(
                graphController.url,
                data,
                services.googleDriveBoardServer.dataPartTransformer()
              );
            }

            if (persistedData) {
              await editor.apply(
                new UpdateAssetData(
                  pendingAssetEdit.assetPath,
                  metadata,
                  persistedData
                )
              );
              await editor.apply(
                new UpdateAssetWithRefs(pendingAssetEdit.assetPath, metadata)
              );
            } else {
              await editor.apply(
                new UpdateAssetWithRefs(pendingAssetEdit.assetPath, metadata)
              );
            }
          }
        }
      }
    }
  }
);
