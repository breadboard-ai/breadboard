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

import {
  signalTrigger,
  stateEventTrigger,
  keyboardTrigger,
  type SignalTrigger,
  type EventTrigger,
  type KeyboardTrigger,
} from "../../coordination.js";
import { isFocusedOnGraphRenderer } from "../binder.js";
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

// =============================================================================
// State Event Triggers
// =============================================================================

/** Fires when a node action is requested (run/stop from the console or graph). */
export function onNodeAction(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger(
    "Node Action",
    services.stateEventBus,
    "node.action"
  );
}

// =============================================================================
// Keyboard Triggers
// =============================================================================

/**
 * Creates the Copy keyboard trigger with a guard that:
 * 1. Returns false when text is selected (allows native copy)
 * 2. Returns the result of isFocusedOnGraphRenderer otherwise
 */
export function onCopyShortcut(): KeyboardTrigger {
  return keyboardTrigger("Copy Shortcut", ["Cmd+c", "Ctrl+c"], (evt) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return false;
    }
    return isFocusedOnGraphRenderer(evt);
  });
}
