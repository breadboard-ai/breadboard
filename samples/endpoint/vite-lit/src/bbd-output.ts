/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { RunOutputEvent } from "./types";

@customElement("bbd-output")
export class Output extends LitElement {
  @property()
  data: RunOutputEvent[1] | null = null;

  render() {
    if (!this.data) {
      return nothing;
    }
    const { node, outputs } = this.data;
    const { id } = node;
    return html`<div>
      <h4>Output</h4>
      <div id="id">Node ID: ${id}</div>
      <div id="output">Output: ${JSON.stringify(outputs)}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbd-output": Output;
  }
}
