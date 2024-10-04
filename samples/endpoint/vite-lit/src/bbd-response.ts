/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { InspectorResponseEvent } from "./types";

import "./bbd-json-tree";

@customElement("bbd-response")
export class Response extends LitElement {
  @property()
  event: InspectorResponseEvent | null = null;

  render() {
    if (!this.event) {
      return nothing;
    }
    const { status, statusText, events } = this.event.response;
    return html`<div>
      <h2>Response</h2>
      <div id="response">${status} ${statusText}</div>
      <h3>Events</h3>
      <div id="events">
        ${events.map((event) => {
          return html`<bbd-json-tree .json=${event}></bbd-json-tree>`;
        })}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbd-response": Request;
  }
}
