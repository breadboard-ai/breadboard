/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for ScreenSize actions.
 */

import { eventTrigger, type EventTrigger } from "../../coordination.js";
import {
  NARROW_BREAKPOINT,
  MEDIUM_BREAKPOINT,
} from "../../controller/subcontrollers/global/screen-size-controller.js";

// =============================================================================
// Event Triggers
// =============================================================================

/**
 * Creates a trigger for the narrow media query change event.
 */
export function onNarrowQueryChange(): EventTrigger | null {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }
  const query = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT}px)`);
  return eventTrigger("Narrow Query Change", query, "change");
}

/**
 * Creates a trigger for the medium media query change event.
 */
export function onMediumQueryChange(): EventTrigger | null {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }
  const query = window.matchMedia(`(max-width: ${MEDIUM_BREAKPOINT}px)`);
  return eventTrigger("Medium Query Change", query, "change");
}

/**
 * Creates a combined trigger for both narrow and medium media query changes.
 * Returns the narrow trigger as the primary (both fire on same breakpoint crossings).
 */
export function onScreenSizeChange(): EventTrigger | null {
  // The narrow breakpoint trigger covers the most common case.
  // When screen size changes, updateScreenSize checks both queries.
  return onNarrowQueryChange();
}
