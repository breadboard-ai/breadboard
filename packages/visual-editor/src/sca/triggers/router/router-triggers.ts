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
    const { controller } = bind;
    controller.router.updateFromCurrentUrl();
  };

  bind.registerEventBridge("Router URL Change", window, "popstate", handler);
}

/**
 * Trigger that fires the initial URL state event during SCA initialization.
 *
 * This replaces the `Router.init()` call that was manually invoked
 * in main-base.ts after runtime initialization.
 */
export function registerInitTrigger() {
  // Fire immediately during registration - this is a one-time init
  const { controller } = bind;
  controller.router.init();

  // Register with empty handler since init is synchronous and one-time
  bind.register("Router Init Trigger", () => { });
}
