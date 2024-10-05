/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { InspectorResponseEvent } from "./types";

import "./bbd-response-event";

@customElement("bbd-run-response")
export class RunResponse extends LitElement {
  @property()
  event: InspectorResponseEvent | null = null;

  render() {
    if (!this.event) {
      return nothing;
    }
    const { status, statusText, events } = this.event.response;
    return html` <h2>Response</h2>
      <div>
        <div id="response">${status} ${statusText}</div>
        <h3>Events</h3>
        <div id="events">
          ${events.map((event) => {
            return html`<bbd-response-event
              .event=${event}
            ></bbd-response-event>`;
          })}
        </div>
      </div>`;
  }

  static styles = css`
    :host {
      display: block;
      padding-bottom: 1.5rem;
    }

    :host > div {
      padding-left: 1rem;
      border-left: 1px solid #ccc;
    }

    h2,
    h3 {
      margin: 0;
      padding-bottom: 0.5rem;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "bbd-run-response": Request;
  }
}
