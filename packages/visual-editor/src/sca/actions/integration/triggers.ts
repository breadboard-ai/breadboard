/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Integration actions.
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
 * This is used to sync integrations from the graph descriptor to the controller.
 *
 * Returns the version number (truthy for non-zero) so the trigger fires
 * whenever version changes, not just when it first becomes >= 0.
 */
export function onGraphVersionChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Graph Version Change (Integrations)", () => {
    const { controller } = bind;
    const graphController = controller.editor.graph;
    const graph = graphController.graph;
    const version = graphController.version;

    // Skip if no graph loaded
    if (!graph) {
      return false;
    }

    // Return version + 1 (a UNIQUE truthy value) so coordination fires the action.
    // The coordination system tracks previousValue and only fires when this changes.
    return version + 1;
  });
}
