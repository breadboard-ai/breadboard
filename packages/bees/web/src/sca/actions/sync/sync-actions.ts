/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asAction, ActionMode } from "../../coordination.js";
import { makeAction } from "../binder.js";
import type { TicketData } from "../../../../../common/types.js";
import {
  onTicketAdded,
  onTicketUpdate,
  onSessionEvent,
  onInitTickets,
  onDrainStart,
  onDrainComplete,
  onDrainError,
  onConnectionError,
} from "./sync-triggers.js";

export const bind = makeAction();

async function doUpsertTicket(ticket: TicketData) {
  const { controller } = bind;
  const c = controller.global;
  const current = c.tickets;
  const idx = current.findIndex((t) => t.id === ticket.id);

  if (idx >= 0) {
    const updated = [...current];
    updated[idx] = ticket;
    c.tickets = updated;
  } else {
    c.tickets = [ticket, ...current];
  }

  // Glow the chat dot when a chat-tagged agent becomes suspended
  // (waiting for user) while the float is minimized.
  if (
    ticket.tags?.includes("chat") &&
    ticket.status === "suspended" &&
    ticket.assignee === "user" &&
    controller.chat.isMinimized
  ) {
    controller.chat.hasUnreadFloat = true;
  }
}

export const upsertTicketOnAdd = asAction(
  "Upsert Ticket On Add",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onTicketAdded(bind),
  },
  async (evt?: Event) => {
    if (!evt) return;
    const ticket = (evt as CustomEvent<TicketData>).detail;
    if (ticket) await doUpsertTicket(ticket);
  }
);

export const upsertTicketOnUpdate = asAction(
  "Upsert Ticket On Update",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onTicketUpdate(bind),
  },
  async (evt?: Event) => {
    if (!evt) return;
    const ticket = (evt as CustomEvent<TicketData>).detail;
    if (ticket) await doUpsertTicket(ticket);
  }
);

export const appendSessionEvent = asAction(
  "Append Session Event",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onSessionEvent(bind),
  },
  async (evt?: Event) => {
    if (!evt) return;
    const payload = (
      evt as CustomEvent<{ ticket_id: string; event: Record<string, unknown> }>
    ).detail;
    if (!payload) return;

    const { controller } = bind;
    const c = controller.global;
    const current = c.tickets;
    const idx = current.findIndex((t) => t.id === payload.ticket_id);

    if (idx < 0) return;

    const updated = [...current];
    const ticket = { ...updated[idx] };
    ticket.events_log = [...(ticket.events_log || []), payload.event];
    updated[idx] = ticket;

    c.tickets = updated;
  }
);

export const initTickets = asAction(
  "Init Tickets",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onInitTickets(bind),
  },
  async (evt?: Event) => {
    if (!evt) return;
    const tickets = (evt as CustomEvent<TicketData[]>).detail;
    const { controller } = bind;
    controller.global.tickets = tickets;
  }
);

export const setDrainingStart = asAction(
  "Set Draining Start",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onDrainStart(bind),
  },
  async () => {
    const { controller } = bind;
    controller.global.draining = true;
  }
);

async function doSetDrainingStop() {
  const { controller } = bind;
  controller.global.draining = false;
}

export const setDrainingStopComplete = asAction(
  "Set Draining Stop Complete",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onDrainComplete(bind),
  },
  async () => {
    await doSetDrainingStop();
  }
);

export const setDrainingStopError = asAction(
  "Set Draining Stop Error",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onDrainError(bind),
  },
  async () => {
    await doSetDrainingStop();
  }
);

export const surfaceConnectionError = asAction(
  "Surface Connection Error",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onConnectionError(bind),
  },
  async (evt?: Event) => {
    const { controller } = bind;
    const detail = (evt as CustomEvent<{ message: string }>)?.detail;
    const message = detail?.message ?? "Server connection error";

    controller.global.toasts = [
      ...controller.global.toasts,
      {
        id: `conn-${Date.now()}`,
        message,
        type: "error",
        timeoutMs: 8000,
      },
    ];
  }
);
