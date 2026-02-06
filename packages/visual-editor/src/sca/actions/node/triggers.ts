/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Node actions.
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";

type ActionBind = { controller: AppController; services: AppServices };

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when a node's configuration changes.
 * Returns true when lastNodeConfigChange is truthy.
 */
export function onNodeConfigChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Node Config Change", () => {
    const { controller } = bind;
    // Return true when there's a config change - reactive system tracks the value
    return !!controller.editor.graph.lastNodeConfigChange;
  });
}
