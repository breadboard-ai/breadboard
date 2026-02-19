/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Graph actions.
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import { type ActionBind } from "../binder.js";

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when there's a pending graph replacement.
 * Returns true when pendingGraphReplacement is truthy.
 */
export function onPendingGraphReplacement(bind: ActionBind): SignalTrigger {
  return signalTrigger("Pending Graph Replacement", () => {
    const { controller } = bind;
    return !!controller.editor.graph.pendingGraphReplacement;
  });
}
