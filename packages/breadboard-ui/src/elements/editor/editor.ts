/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-editor")
export class Editor extends LitElement {
  @property()
  x = 1;

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgb(244, 247, 252);
      background-image: var(--bb-grid-pattern);
      background-position: var(--diagram-x, 0) var(--diagram-y, 0);
      overflow: auto;
      position: relative;
      user-select: none;
      pointer-events: auto;
      width: 100%;
      height: 100%;
    }
  `;

  reset() {
    // To be implemented...
  }

  render() {
    return html`Coming soon`;
  }
}
