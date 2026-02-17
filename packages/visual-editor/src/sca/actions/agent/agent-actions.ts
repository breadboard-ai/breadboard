/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for Agent context management.
 */

import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onGraphVersionChange, onGraphUrlChange } from "./triggers.js";

export const bind = makeAction();

// =============================================================================
// Actions
// =============================================================================

/**
 * Invalidates resumable runs when the graph version changes.
 *
 * **Triggers:**
 * - `onGraphVersionChange`: Fires when graph version changes
 */
export const invalidateResumableRuns = asAction(
  "Agent.invalidateResumableRuns",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onGraphVersionChange(bind),
  },
  async (): Promise<void> => {
    const { services } = bind;
    services.agentContext.invalidateResumableRuns();
  }
);

/**
 * Clears all runs when the graph URL changes.
 * This ensures runs from one graph don't persist when switching to another.
 *
 * **Triggers:**
 * - `onGraphUrlChange`: Fires when graph URL changes (not on initial load)
 */
export const clearRunsOnGraphChange = asAction(
  "Agent.clearRunsOnGraphChange",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onGraphUrlChange(bind),
  },
  async (): Promise<void> => {
    const { services } = bind;
    services.agentContext.clearAllRuns();
  }
);
