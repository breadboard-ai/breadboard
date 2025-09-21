/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("console-view")
export class ConsoleView extends LitElement {
  @property({ type: Array })
  log: unknown[][] = [];

  static styles = css`
    :host {
      border-top: 1px solid #ccc;
      padding-top: 10px;
      overflow-y: auto;
      height: 200px;
    }
    h1 {
      font-size: 1.2em;
      margin-top: 0;
    }
    .log-entry {
      font-family: monospace;
      padding: 5px;
      border-bottom: 1px solid #eee;
    }
  `;

  render() {
    return html`
      <h1>Console</h1>
      ${this.log.map(
        (entry) =>
          html`<div class="log-entry">
            ${entry
              .map((item) =>
                typeof item === "string" ? item : JSON.stringify(item)
              )
              .join(" ")}
          </div>`
      )}
    `;
  }
}
