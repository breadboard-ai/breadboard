/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type ResultArgs = {
  title: string;
  result: string;
};

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-result")
export class Result extends LitElement {
  @property()
  title: ResultArgs["title"] = "";

  @property()
  result: ResultArgs["result"] = "";

  static styles = css`
    :host {
      display: block;
    }

    details {
      border-radius: calc(var(--bb-grid-size) * 4);
      background: rgb(240, 240, 240);
      list-style: none;
    }

    #output-wrapper {
      border-radius: 0 0 calc(var(--bb-grid-size) * 4)
        calc(var(--bb-grid-size) * 4);
      background: rgb(240, 240, 240);
      padding-bottom: calc(var(--bb-grid-size) * 8);
    }

    summary {
      list-style: none;
      font-size: var(--bb-text-small);
      font-weight: 500;
      padding: calc(var(--bb-grid-size) * 3) calc(var(--bb-grid-size) * 8);
    }

    summary::-webkit-details-marker {
      display: none;
    }

    pre {
      line-height: 1.5;
      overflow-x: auto;
      padding: calc(var(--bb-grid-size) * 3) calc(var(--bb-grid-size) * 8);
      background: rgb(253, 253, 255);
      font-size: var(--bb-text-medium);
      margin: 0;
      white-space: pre-line;
    }
  `;

  render() {
    return html`<details>
      <summary>${this.title}</summary>
      <div id="output-wrapper">
        <pre>${this.result}</pre>
      </div>
    </details>`;
  }
}
