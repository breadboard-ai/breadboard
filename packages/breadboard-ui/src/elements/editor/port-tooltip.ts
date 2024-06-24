/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Schema } from "@google-labs/breadboard";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("pp-port-tooltip")
export class PortTooltip extends LitElement {
  @property({ reflect: false, type: Object })
  schema?: Schema;

  static styles = css`
    pre {
      font-size: 12px;
      padding: 2px 12px;
      text-wrap: wrap;
      width: 350px;
    }
  `;

  override render() {
    // TODO(aomarks) Make a nicely styled version of this.
    return html`<pre>${JSON.stringify(this.schema, null, 2)}</pre>`;
  }
}
