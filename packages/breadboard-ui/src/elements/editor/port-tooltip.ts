/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type InspectablePort } from "@google-labs/breadboard";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("pp-port-tooltip")
export class PortTooltip extends LitElement {
  @property({ reflect: false, type: Object })
  port?: InspectablePort;

  static styles = css`
    pre {
      font-size: 12px;
      padding: 2px 12px;
      text-wrap: wrap;
      width: 350px;
    }
  `;

  override render() {
    if (!this.port) {
      return nothing;
    }
    const info = {
      name: this.port.name,
      title: this.port.title,
      status: this.port.status,
      configured: this.port.configured,
      schema: this.port.schema,
    };
    // TODO(aomarks) Make a nicely styled version of this.
    return html`<pre>${JSON.stringify(info, null, 2)}</pre>`;
  }
}
