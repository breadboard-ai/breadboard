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

export function onAgentAdded(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger("Agent Added", services.stateEventBus, "agent_added");
}

export function onAgentUpdated(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger("Agent Updated", services.stateEventBus, "agent_updated");
}

export function onSessionEvent(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger("Session Event", services.stateEventBus, "session_event");
}

export function onSchedulerStarted(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Scheduler Started",
    services.stateEventBus,
    "scheduler_started"
  );
}

export function onSchedulerStopped(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Scheduler Stopped",
    services.stateEventBus,
    "scheduler_stopped"
  );
}

export function onConnectionError(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Connection Error",
    services.stateEventBus,
    "connection_error"
  );
}
