/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Agent actions.
 *
 * These are factory functions that create trigger definitions.
 * They take `bind` as a parameter to avoid circular dependencies.
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import { type ActionBind } from "../binder.js";

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when graph version changes (for invalidation).
 */
export function onGraphVersionChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Graph Version Change", () => {
    const { controller } = bind;
    const { version, readOnly } = controller.editor.graph;

    // Skip read-only graphs — invalidation doesn't apply.
    if (readOnly) return false;

    // +1 so version 0 isn't falsy; each increment produces a unique value.
    return version >= 0 ? version + 1 : false;
  });
}

/**
 * Creates a trigger that fires when graph URL changes.
 * Tracks previous URL to detect actual changes.
 */
export function onGraphUrlChange(bind: ActionBind): SignalTrigger {
  let previousUrl: string | null = null;

  return signalTrigger("Graph URL Change", () => {
    const { controller } = bind;
    const { url } = controller.editor.graph;

    // Skip if URL hasn't changed
    if (url === previousUrl) {
      return false;
    }

    const hadPreviousUrl = previousUrl !== null;
    previousUrl = url;

    // Return true only on actual change (not initial load)
    return hadPreviousUrl;
  });
}
