/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import type { AppController, AppServices } from "../../types.js";

type ActionBind = { controller: AppController; services: AppServices };

export function onTicketsUpdate({ controller }: ActionBind): SignalTrigger {
  return signalTrigger("Tickets Update", () => {
    return controller.global.tickets.length > 0
      ? controller.global.tickets
      : null;
  });
}

/** Fires when the active chat thread changes (e.g. agent selection). */
export function onActiveThreadChange({ controller }: ActionBind): SignalTrigger {
  // Version +1 to avoid sticky trigger — we care about the change,
  // not the current value.
  let lastSeen: string | null = undefined as unknown as string | null;
  return signalTrigger("Active Thread Change", () => {
    const current = controller.chat.activeThreadId;
    if (current === lastSeen) return null;
    lastSeen = current;
    return current ?? "cleared";
  });
}
