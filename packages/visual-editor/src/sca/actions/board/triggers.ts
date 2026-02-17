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
  stateEventTrigger,
  keyboardTrigger,
  type SignalTrigger,
  type EventTrigger,
  type KeyboardTrigger,
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

// =============================================================================
// Keyboard Triggers
// =============================================================================

/** Fires on Cmd+s / Ctrl+s when an editor is available. */
export function onSaveShortcut(bind: ActionBind): KeyboardTrigger {
  return keyboardTrigger("Save Shortcut", ["Cmd+s", "Ctrl+s"], () => {
    const { controller } = bind;
    return !!controller.editor.graph.editor;
  });
}

// =============================================================================
// State Event Triggers (Board Routes)
// =============================================================================
// Migrated from event-routing/board/board.ts.

/** Fires when the user requests a board run. */
export function onBoardRun(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger("Board Run", services.stateEventBus, "board.run");
}

/** Fires when the user requests a board stop. */
export function onBoardStop(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger("Board Stop", services.stateEventBus, "board.stop");
}

/** Fires when the user requests a board restart. */
export function onBoardRestart(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger(
    "Board Restart",
    services.stateEventBus,
    "board.restart"
  );
}

/** Fires when user input is provided during a run. */
export function onBoardInput(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger(
    "Board Input",
    services.stateEventBus,
    "board.input"
  );
}

/** Fires when a new board is created. */
export function onBoardCreate(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger(
    "Board Create",
    services.stateEventBus,
    "board.create"
  );
}

/** Fires when a board remix is requested. */
export function onBoardRemix(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger(
    "Board Remix",
    services.stateEventBus,
    "board.remix"
  );
}

/** Fires when a board deletion is requested. */
export function onBoardDelete(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger(
    "Board Delete",
    services.stateEventBus,
    "board.delete"
  );
}
