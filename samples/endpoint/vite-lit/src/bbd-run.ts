/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { InspectorEvent, SettingsData } from "./types";
import { createRequestEvent, makeRunRequest } from "./common";

import "./bbd-request";
import "./bbd-response";

@customElement("bbd-run")
export class Run extends LitElement {
  @property()
  settings: SettingsData | null = null;

  @state()
  running = false;

  @state()
  events: InspectorEvent[] = [];

  render() {
    if (!this.settings) {
      return nothing;
    }
    if (this.running) {
      return html`${this.events.map((event) => {
        switch (event.type) {
          case "request":
            return html`<bbd-request .event=${event}></bbd-request>`;
          case "response":
            return html`<bbd-response .event=${event}></bbd-response>`;
        }
      })}`;
    } else {
      return html`<button @click=${this.startRun}>Start</button>`;
    }
  }

  #jumpToBottom(behavior: ScrollBehavior = "smooth") {
    requestAnimationFrame(() => {
      const last = this.shadowRoot!.querySelector<HTMLElement>(":last-child");
      if (!last) {
        return;
      }

      last.scrollIntoView({
        behavior,
        block: "start",
        inline: "nearest",
      });
    });
  }

  #appendEvent(event: InspectorEvent) {
    this.events = [...this.events, event];
    this.#jumpToBottom();
  }

  async startRun() {
    this.running = true;
    const requestEvent = createRequestEvent("run", this.settings!);
    this.#appendEvent(requestEvent);
    await makeRunRequest(requestEvent).then((responseEvent) => {
      this.#appendEvent(responseEvent);
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbd-run": Run;
  }
}
