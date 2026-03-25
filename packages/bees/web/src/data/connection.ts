/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BeesState } from "./state.js";

export { BeesConnection };

/**
 * Manages the SSE connection to the Bees backend, parsing raw server-sent
 * events and writing directly to the reactive BeesState.
 * Handles reconnection on error.
 */
class BeesConnection {
  #source: EventSource | null = null;
  #state: BeesState;

  constructor(state: BeesState) {
    this.#state = state;
  }

  connect() {
    this.#source = new EventSource("/events");

    this.#source.addEventListener("init", (e: MessageEvent) => {
      this.#state.tickets.set(JSON.parse(e.data));
    });

    this.#source.addEventListener("ticket_added", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.#state.upsertTicket(data.ticket);
    });

    this.#source.addEventListener("ticket_update", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.#state.upsertTicket(data.ticket);
    });

    this.#source.addEventListener("session_event", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.#state.appendEvent(data.ticket_id, data.event);
    });

    this.#source.addEventListener("drain_start", () => {
      this.#state.draining.set(true);
    });

    this.#source.addEventListener("drain_complete", () => {
      this.#state.draining.set(false);
    });

    this.#source.addEventListener("drain_error", () => {
      this.#state.draining.set(false);
    });

    this.#source.onerror = () => {
      this.close();
      setTimeout(() => this.connect(), 2000);
    };
  }

  close() {
    this.#source?.close();
    this.#source = null;
  }
}
