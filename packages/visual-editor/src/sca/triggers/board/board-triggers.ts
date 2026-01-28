/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SnackType } from "../../../ui/types/types.js";
import { makeTrigger } from "../binder.js";

export const bind = makeTrigger();

/**
 * Trigger that saves the graph when the version changes.
 *
 * @param deps The dependencies for the trigger.
 * @returns The trigger.
 */
export function registerSaveTrigger() {
  bind.register("Save Trigger", () => {
    const { controller, actions } = bind;
    const { version, readOnly, editor } = controller.editor.graph;
    if (readOnly || version === -1 || !editor) {
      return;
    }

    actions.board.save();
  });
}

/**
 * Trigger that shows a snackbar when a newer version of a shared graph is available.
 *
 * Replaces the RuntimeNewerSharedVersionEvent listener in main-base.ts.
 */
export function registerNewerVersionTrigger() {
  bind.register("Newer Version Trigger", () => {
    const { controller } = bind;
    const { newerVersionAvailable } = controller.board.main;

    if (!newerVersionAvailable) {
      return;
    }

    // Show the snackbar
    controller.global.snackbars.snackbar(
      "A newer version of this board is available",
      SnackType.INFORMATION,
      [],
      true, // persistent
      globalThis.crypto.randomUUID(),
      true // replaceAll
    );

    // Reset the flag so it doesn't trigger again
    controller.board.main.newerVersionAvailable = false;
  });
}

/**
 * Sets up the save status listener on googleDriveBoardServer.
 * Updates controller.editor.graph.saveStatus when the board server reports changes.
 *
 * This is not a signal-driven trigger but an external event listener that
 * bridges the googleDriveBoardServer's savestatuschange event to SCA state.
 */
export function registerSaveStatusListener() {
  const { controller, services } = bind;

  // TODO: This is not a trigger - it's an event listener. We should use
  // signals instead.
  services.googleDriveBoardServer.addEventListener(
    "savestatuschange",
    ({ url, status }) => {
      const currentUrl = controller.editor.graph.url;

      // Only update if this is the current graph
      if (!currentUrl || currentUrl !== url) {
        return;
      }

      // Map BoardServerSaveEventStatus to our simplified status
      switch (status) {
        case "saving":
          controller.editor.graph.saveStatus = "saving";
          break;
        case "idle":
          controller.editor.graph.saveStatus = "saved";
          break;
        case "debouncing":
        case "queued":
          controller.editor.graph.saveStatus = "unsaved";
          break;
        default:
          controller.editor.graph.saveStatus = "saved";
          break;
      }
    }
  );
}

