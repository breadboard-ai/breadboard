/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { eventTrigger, type EventTrigger } from "../../coordination.js";
import type { AppController, AppServices } from "../../types.js";

type ActionBind = { controller: AppController; services: AppServices };

export function onInitTickets(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger("Init Tickets", services.stateEventBus, "init_tickets");
}

export function onTicketAdded(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger("Ticket Added", services.stateEventBus, "ticket_added");
}

export function onTicketUpdate(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger("Ticket Update", services.stateEventBus, "ticket_update");
}

export function onSessionEvent(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger("Session Event", services.stateEventBus, "session_event");
}

export function onDrainStart(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger("Drain Start", services.stateEventBus, "drain_start");
}

export function onDrainComplete(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Drain Complete",
    services.stateEventBus,
    "drain_complete"
  );
}

export function onDrainError(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger("Drain Error", services.stateEventBus, "drain_error");
}

export function onConnectionError(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Connection Error",
    services.stateEventBus,
    "connection_error"
  );
}
