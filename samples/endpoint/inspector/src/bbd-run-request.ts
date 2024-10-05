/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement, nothing } from "lit";
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
    return html`<h2>Request</h2>
      <div>
        <div id="request">${method} ${url}</div>
        <h3>Headers</h3>
        <div id="headers">
          <bbd-json-tree .json=${headers}></bbd-json-tree>
        </div>
        <h3>Body</h3>
        <div id="body">
          <bbd-json-tree .json=${JSON.parse(body)}></bbd-json-tree>
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

    #request {
      font-family: var(--bb-font-family-mono, monospace);
      font-size: var(--bb-text-nano, 0.8rem);
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
    "bbd-run-request": RunRequest;
  }
}
