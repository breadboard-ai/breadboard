/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";

import type { TicketData } from "./types.js";

export { BeesState };

/**
 * Signal-backed reactive state for the Bees UI. Domain data lives here;
 * ephemeral form state (text inputs, editing flags) stays in the component.
 */
class BeesState {
  readonly tickets = new Signal.State<TicketData[]>([]);
  readonly draining = new Signal.State(false);

  upsertTicket(ticket: TicketData) {
    const current = this.tickets.get();
    const idx = current.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) {
      const updated = [...current];
      updated[idx] = ticket;
      this.tickets.set(updated);
    } else {
      this.tickets.set([ticket, ...current]);
    }
  }

  appendEvent(ticketId: string, event: Record<string, unknown>) {
    const current = this.tickets.get();
    const idx = current.findIndex((t) => t.id === ticketId);
    if (idx < 0) return;

    const updated = [...current];
    const t = { ...updated[idx] };
    t.events_log = [...(t.events_log || []), event];
    updated[idx] = t;
    this.tickets.set(updated);
  }
}
