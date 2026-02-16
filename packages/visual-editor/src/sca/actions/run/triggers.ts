/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Run actions.
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";

type ActionBind = { controller: AppController; services: AppServices };

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when graph version changes.
 * Used to sync run console state when graph topology changes during a run.
 */
export function onGraphVersionForSync(bind: ActionBind): SignalTrigger {
  return signalTrigger("Graph Version (Sync)", () => {
    const { controller } = bind;
    // Return true when version is valid - reactive system tracks changes
    return controller.editor.graph.version >= 0;
  });
}

/**
 * Creates a trigger that fires when a node action request is set.
 *
 * Watches RunController.nodeActionRequest and fires when it changes
 * to a non-null value. Used by executeNodeAction to dispatch the
 * run/stop/runFrom/runNode command.
 */
export function onNodeActionRequested(bind: ActionBind): SignalTrigger {
  return signalTrigger("Node Action Requested (Run)", () => {
    const { controller } = bind;
    return controller.run.main.nodeActionRequest !== null;
  });
}

/**
 * Creates a trigger that fires when graph topology changes.
 * Used to re-prepare the runner so the console reflects the current graph.
 */
export function onTopologyChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Topology Change (Re-prepare)", () => {
    const { controller } = bind;
    // +1 so version 0 isn't falsy; each increment produces a unique value.
    return controller.editor.graph.topologyVersion + 1;
  });
}
