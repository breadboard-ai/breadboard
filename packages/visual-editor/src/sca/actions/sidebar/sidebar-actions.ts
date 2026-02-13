/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for Sidebar state management.
 *
 * Handles selection-driven sidebar toggling: when items are selected,
 * switch to "editor"; when deselected, switch to "preview".
 */

import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onSelectionChange } from "./triggers.js";

export const bind = makeAction();

// =============================================================================
// Triggered Actions
// =============================================================================

/**
 * Updates the sidebar section based on selection state.
 *
 * When the selection becomes non-empty and the sidebar isn't already
 * showing the editor, switch to it. When the selection becomes empty
 * and the sidebar is showing the editor, switch back to preview.
 *
 * **Triggers:**
 * - `onSelectionChange`: Fires when selectionId changes
 */
export const updateSidebarOnSelectionChange = asAction(
  "Sidebar.updateOnSelectionChange",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onSelectionChange(bind),
    // The sidebar section is persisted to localStorage. On page refresh,
    // "editor" may be restored but there's no selection yet. Running this
    // action on activation reconciles the persisted value with reality.
    runOnActivate: true,
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const selectionSize = controller.editor.selection.size;
    const currentSection = controller.editor.sidebar.section;

    if (selectionSize === 0 && currentSection === "editor") {
      controller.editor.sidebar.section = "preview";
    } else if (selectionSize > 0 && currentSection !== "editor") {
      controller.editor.sidebar.section = "editor";
    }
  }
);
