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
