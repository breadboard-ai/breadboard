/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for Router (URL navigation).
 */

import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onPopstate } from "./triggers.js";

export const bind = makeAction();

// =============================================================================
// Actions
// =============================================================================

/**
 * Updates the RouterController when the browser's popstate event fires
 * (e.g., when the user clicks back/forward buttons).
 *
 * **Triggers:**
 * - `onPopstate`: Fires on browser back/forward navigation
 */
export const updateFromPopstate = asAction(
  "Router.updateFromPopstate",
  {
    mode: ActionMode.Immediate,
    triggeredBy: [() => onPopstate()],
  },
  async (): Promise<void> => {
    const { controller } = bind;
    controller.router.updateFromCurrentUrl();
  }
);

/**
 * Initializes the router with the current URL state.
 * Called once during SCA bootstrap.
 *
 * Note: This action has no triggers - it's called directly during initialization.
 */
export const init = asAction(
  "Router.init",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    controller.router.init();
  }
);
