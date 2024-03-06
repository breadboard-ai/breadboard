/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("bb-node-info")
export class NodeInfo extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      scrollbar-gutter: stable;
      padding: 16px;
    }
  `;

  render() {
    return html`Coming soon...`;
  }
}
