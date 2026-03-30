/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class SSEClient {
  private source: EventSource | null = null;
  private bus: EventTarget;

  constructor(bus: EventTarget) {
    this.bus = bus;
  }

  connect() {
    this.source = new EventSource("/events");

    this.source.addEventListener("init", (e: MessageEvent) => {
      this.bus.dispatchEvent(
        new CustomEvent("init_tickets", { detail: JSON.parse(e.data) })
      );
    });

    this.source.addEventListener("ticket_added", (e: MessageEvent) => {
      this.bus.dispatchEvent(
        new CustomEvent("ticket_added", { detail: JSON.parse(e.data).ticket })
      );
    });

    this.source.addEventListener("ticket_update", (e: MessageEvent) => {
      this.bus.dispatchEvent(
        new CustomEvent("ticket_update", { detail: JSON.parse(e.data).ticket })
      );
    });

    this.source.addEventListener("session_event", (e: MessageEvent) => {
      this.bus.dispatchEvent(
        new CustomEvent("session_event", { detail: JSON.parse(e.data) })
      );
    });

    this.source.addEventListener("drain_start", () => {
      this.bus.dispatchEvent(new CustomEvent("drain_start"));
    });

    this.source.addEventListener("drain_complete", () => {
      this.bus.dispatchEvent(new CustomEvent("drain_complete"));
    });

    this.source.addEventListener("drain_error", () => {
      this.bus.dispatchEvent(new CustomEvent("drain_error"));
    });

    this.source.onerror = () => {
      this.close();
      setTimeout(() => this.connect(), 2000);
    };
  }

  close() {
    this.source?.close();
    this.source = null;
  }
}
