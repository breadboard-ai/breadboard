/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Asset actions.
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";

type ActionBind = { controller: AppController; services: AppServices };

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when the graph version changes.
 * This is used to sync assets from the graph descriptor to the controller.
 *
 * Returns the version number (truthy for non-zero) so the trigger fires
 * whenever version changes, not just when it first becomes >= 0.
 */
export function onGraphVersionChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Graph Version Change (Assets)", () => {
    const { controller } = bind;
    // Return the version number itself so trigger fires on each change.
    // Add 1 to handle version 0 (which would be falsy).
    return controller.editor.graph.version + 1;
  });
}
