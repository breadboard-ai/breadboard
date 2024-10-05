/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { RunEvent } from "./types";

import "./bbd-json-tree";
import "./bbd-input";
import "./bbd-output";

@customElement("bbd-response-event")
export class ResponseEvent extends LitElement {
  @property()
  event: RunEvent | null = null;

  render() {
    if (!this.event) {
      return nothing;
    }
    const [type, data, next] = this.event;
    const raw = html`<h4>Raw</h4>
      <bbd-json-tree .json=${this.event}></bbd-json-tree>`;
    let info: TemplateResult | symbol = nothing;
    switch (type) {
      case "output": {
        info = html`<h4>Output</h4>
          <bbd-output .data=${data}></bbd-output>`;
        break;
      }
      case "input": {
        info = html`<h4>Input</h4>
          <bbd-input .data=${data} .next=${next}></bbd-input>`;
        break;
      }
      case "error": {
        break;
      }
      default: {
        console.warn(`Unknown event type: ${type}`, this.event);
      }
    }
    return html`<div id="info">${info}</div>
      <div id="raw">${raw}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbd-response-event": ResponseEvent;
  }
}
