/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for ScreenSize management (responsive breakpoints).
 */

import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import {
  NARROW_BREAKPOINT,
  MEDIUM_BREAKPOINT,
} from "../../controller/subcontrollers/global/screen-size-controller.js";
import { onScreenSizeChange } from "./triggers.js";

export const bind = makeAction();

// =============================================================================
// Internal Helper
// =============================================================================

/**
 * Core screen-size update logic, shared by both `updateScreenSize`
 * (coordinated, trigger-driven) and `init` (direct call during bootstrap).
 */
function updateScreenSizeImpl(): void {
  const { controller } = bind;

  // Guard for SSR/test environments
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return;
  }

  const narrowQuery = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT}px)`);
  const mediumQuery = window.matchMedia(`(max-width: ${MEDIUM_BREAKPOINT}px)`);

  if (narrowQuery.matches) {
    controller.global.screenSize.size = "narrow";
  } else if (mediumQuery.matches) {
    controller.global.screenSize.size = "medium";
  } else {
    controller.global.screenSize.size = "wide";
  }
}

// =============================================================================
// Actions
// =============================================================================

/**
 * Updates the screen size state based on media query changes.
 *
 * This action handles both narrow and medium breakpoint changes.
 * It's triggered by media query change events and also runs once
 * during initialization.
 *
 * **Trigger:** `onScreenSizeChange` - Fires on narrow/medium breakpoint changes
 */
export const updateScreenSize = asAction(
  "ScreenSize.updateScreenSize",
  {
    mode: ActionMode.Immediate,
    triggeredBy: onScreenSizeChange,
  },
  async (): Promise<void> => {
    updateScreenSizeImpl();
  }
);

/**
 * Initializes the screen size state.
 * Called once during SCA bootstrap.
 *
 * Calls `updateScreenSizeImpl` directly (not the coordinated wrapper)
 * to avoid nested coordination tracking.
 *
 * Note: This action has no triggers - it's called directly during initialization.
 */
export const init = asAction(
  "ScreenSize.init",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    updateScreenSizeImpl();
  }
);
