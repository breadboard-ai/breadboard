/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { InspectorRequestEvent } from "./types";

import "./bbd-json-tree";

@customElement("bbd-run-request")
export class RunRequest extends LitElement {
  @property()
  event: InspectorRequestEvent | null = null;

  render() {
    if (!this.event) {
      return nothing;
    }
    const { method, url, headers, body } = this.event.request;
    return html`<div>
      <h2>Request</h2>
      <div id="request">${method} ${url}</div>
      <h3>Headers</h3>
      <div id="headers">
        ${Object.entries(headers).map(([name, value]) => {
          return html`<div>${name}: ${value}</div>`;
        })}
      </div>
      <h3>Body</h3>
      <div id="body">
        <bbd-json-tree .json=${JSON.parse(body)}></bbd-json-tree>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbd-run-request": RunRequest;
  }
}
