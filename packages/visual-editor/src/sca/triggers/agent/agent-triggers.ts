/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeTrigger } from "../binder.js";

export const bind = makeTrigger();

/**
 * Trigger that invalidates resumable runs when the graph version changes.
 */
export function registerGraphInvalidateTrigger() {
  bind.register("Graph Invalidate Trigger", () => {
    const { controller, services } = bind;
    const { version, readOnly } = controller.editor.graph;
    if (readOnly || version === -1) {
      return;
    }

    services.agentContext.invalidateResumableRuns();
  });
}

/**
 * Trigger that clears all runs when the graph URL changes.
 * This ensures runs from one graph don't persist when switching to another.
 */
export function registerGraphUrlChangeTrigger() {
  let previousUrl: string | null = null;

  bind.register("Graph URL Change Trigger", () => {
    const { controller, services } = bind;
    const { url } = controller.editor.graph;

    // Skip if URL hasn't changed
    if (url === previousUrl) {
      return;
    }

    // Clear all runs when switching graphs (but not on initial load)
    if (previousUrl !== null) {
      services.agentContext.clearAllRuns();
    }

    previousUrl = url;
  });
}
