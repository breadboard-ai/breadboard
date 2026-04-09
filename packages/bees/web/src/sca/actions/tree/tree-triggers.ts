/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import type { AppController, AppServices } from "../../types.js";

type ActionBind = { controller: AppController; services: AppServices };

/**
 * Fires when the selected agent changes.
 *
 * Uses the "lastSeen" pattern to avoid the Sticky Trigger Hazard:
 * the trigger only fires when `selectedAgentId` transitions to a
 * *different* value, including transitions to `null` (deselection).
 */
export function onAgentSelected({ controller }: ActionBind): SignalTrigger {
  let lastSeen: string | null = undefined as unknown as string | null;
  return signalTrigger("Agent Selected", () => {
    const current = controller.agentTree.selectedAgentId;
    if (current === lastSeen) return null;
    lastSeen = current;
    return current ?? "cleared";
  });
}
