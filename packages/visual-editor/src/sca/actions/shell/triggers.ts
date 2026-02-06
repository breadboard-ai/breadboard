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
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";

type ActionBind = { controller: AppController; services: AppServices };

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when the graph title changes.
 */
export function onTitleChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Graph Title Change", () => {
    const { controller } = bind;
    // Return true when there's a title - reactive system tracks title changes
    return controller.editor.graph.title !== null;
  });
}
