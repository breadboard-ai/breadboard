/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Board actions.
 *
 * These are factory functions that create trigger definitions.
 * They take `bind` as a parameter to avoid circular dependencies.
 *
 * The actual wiring happens in the action definitions via the `triggeredBy` array.
 */

import {
  signalTrigger,
  eventTrigger,
  type SignalTrigger,
  type EventTrigger,
} from "../../coordination.js";
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";

type ActionBind = { controller: AppController; services: AppServices };

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when the graph version changes and save conditions are met.
 *
 * Conditions:
 * - Graph is not read-only
 * - Version is valid (not -1)
 * - Editor is available
 */
export function onVersionChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Board Version Change", () => {
    const { controller } = bind;
    const { version, readOnly, editor } = controller.editor.graph;

    // Return a unique truthy value per version so each increment fires.
    // We use version + 1 because version 0 is falsy.
    if (readOnly || version < 0 || !editor) {
      return false;
    }
    return version + 1;
  });
}

/**
 * Creates a trigger that fires when a newer version of a shared graph is available.
 */
export function onNewerVersionAvailable(bind: ActionBind): SignalTrigger {
  return signalTrigger("Newer Version Available", () => {
    const { controller } = bind;
    // Return true when newer version is available - reactive system tracks changes
    return !!controller.board.main.newerVersionAvailable;
  });
}

// =============================================================================
// Event Triggers
// =============================================================================

/**
 * Creates a trigger that fires on the save status change event from the board server.
 *
 * This bridges the external googleDriveBoardServer event to SCA actions.
 */
export function onSaveStatusChange(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Save Status Change",
    services.googleDriveBoardServer,
    "savestatuschange"
  );
}
