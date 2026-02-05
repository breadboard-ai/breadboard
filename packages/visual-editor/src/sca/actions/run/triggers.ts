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

import {
  EventTrigger,
  eventTrigger,
  signalTrigger,
  type SignalTrigger,
} from "../../coordination.js";
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";

type ActionBind = { controller: AppController; services: AppServices };

export function onDblClick(): EventTrigger {
  return eventTrigger("Double Click Test Handler", window, "dblclick");
}

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when graph version changes.
 * Used to sync run console state when graph topology changes during a run.
 */
export function onGraphVersionForSync(bind: ActionBind): SignalTrigger {
  return signalTrigger(
    "Graph Version (Sync)",
    () => {
      const { controller } = bind;
      // Return true when version is valid - reactive system tracks changes
      return controller.editor.graph.version >= 0;
    }
  );
}
