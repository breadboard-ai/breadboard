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

    this.source.addEventListener("agent:added", (e: MessageEvent) => {
      this.bus.dispatchEvent(
        new CustomEvent("agent_added", { detail: JSON.parse(e.data).agent })
      );
    });

    this.source.addEventListener("agent:updated", (e: MessageEvent) => {
      this.bus.dispatchEvent(
        new CustomEvent("agent_updated", { detail: JSON.parse(e.data).agent })
      );
    });

    this.source.addEventListener("session:event", (e: MessageEvent) => {
      this.bus.dispatchEvent(
        new CustomEvent("session_event", { detail: JSON.parse(e.data) })
      );
    });

    this.source.addEventListener("scheduler:started", () => {
      this.bus.dispatchEvent(new CustomEvent("scheduler_started"));
    });

    this.source.addEventListener("scheduler:stopped", () => {
      this.bus.dispatchEvent(new CustomEvent("scheduler_stopped"));
    });

    this.source.onerror = () => {
      this.bus.dispatchEvent(
        new CustomEvent("connection_error", {
          detail: { message: "Connection to server lost. Reconnecting…" },
        })
      );
      this.close();
      setTimeout(() => this.connect(), 2000);
    };
  }

  close() {
    this.source?.close();
    this.source = null;
  }
}
