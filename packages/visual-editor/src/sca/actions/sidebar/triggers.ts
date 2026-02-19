/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Sidebar actions.
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import { type ActionBind } from "../binder.js";

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when the selection changes.
 *
 * Returns the selectionId so the trigger system detects value changes
 * and fires the associated action on each selection update.
 */
export function onSelectionChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Selection Change → Sidebar", () => {
    const { controller } = bind;
    return controller.editor.selection.selectionId;
  });
}
