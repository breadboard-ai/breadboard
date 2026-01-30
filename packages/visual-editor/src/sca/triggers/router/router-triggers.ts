/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeTrigger } from "../binder.js";

export const bind = makeTrigger();

/**
 * Trigger that updates the RouterController when the browser's popstate event
 * fires (e.g., when the user clicks back/forward buttons).
 *
 * This replaces the popstate listener that was previously in the legacy
 * `Runtime.Router` constructor.
 */
export function registerPopstateTrigger() {
  const handler = () => {
    bind.controller.router.updateFromCurrentUrl();
  };

  window.addEventListener("popstate", handler);

  // TODO: Implement untrigger pattern for proper cleanup.
  // Currently no mechanism exists in the trigger system for removal.

  bind.register("Router URL Change Trigger", handler);
}

/**
 * Trigger that fires the initial URL state event during SCA initialization.
 *
 * This replaces the `Router.init()` call that was manually invoked
 * in main-base.ts after runtime initialization.
 */
export function registerInitTrigger() {
  // Fire immediately during registration - this is a one-time init
  bind.controller.router.init();

  // Register with empty handler since init is synchronous and one-time
  bind.register("Router Init Trigger", () => { });
}
