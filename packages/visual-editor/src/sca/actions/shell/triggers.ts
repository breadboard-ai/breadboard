/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Shell actions.
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import { type ActionBind } from "../binder.js";

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when the graph title changes.
 */
export function onTitleChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Graph Title Change", () => {
    const { controller } = bind;
    // Coerce null → sentinel so the trigger fires when the title is cleared.
    // signalTrigger only fires on truthy values; raw null would be swallowed.
    return controller.editor.graph.title ?? "∅";
  });
}
