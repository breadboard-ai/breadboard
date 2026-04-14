/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Router actions.
 */

import { eventTrigger, type EventTrigger } from "../../coordination.js";

// =============================================================================
// Event Triggers
// =============================================================================

/**
 * Creates a trigger that fires on browser popstate events (back/forward navigation).
 */
export function onPopstate(): EventTrigger {
  return eventTrigger("Browser Popstate", window, "popstate");
}
