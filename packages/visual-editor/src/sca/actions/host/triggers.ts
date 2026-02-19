/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Host actions.
 */

import { stateEventTrigger, type EventTrigger } from "../../coordination.js";
import { type ActionBind } from "../binder.js";

// =============================================================================
// State Event Triggers
// =============================================================================

/**
 * Fires when the host requests a mode toggle (e.g. canvas ↔ app).
 */
export function onModeToggle(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger(
    "Host Mode Toggle",
    services.stateEventBus,
    "host.modetoggle"
  );
}

/**
 * Fires when the host requests the UI to be locked.
 */
export function onLock(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger("Host Lock", services.stateEventBus, "host.lock");
}

/**
 * Fires when the host requests the UI to be unlocked.
 */
export function onUnlock(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger(
    "Host Unlock",
    services.stateEventBus,
    "host.unlock"
  );
}

/**
 * Fires when the host requests a flag change.
 */
export function onFlagChange(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger(
    "Host Flag Change",
    services.stateEventBus,
    "host.flagchange"
  );
}

/**
 * Fires when the user signs in via the host.
 */
export function onUserSignIn(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger(
    "Host User Sign In",
    services.stateEventBus,
    "host.usersignin"
  );
}
