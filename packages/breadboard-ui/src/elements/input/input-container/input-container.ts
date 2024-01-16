/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("bb-input-container")
export class InputContainer extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: calc(var(--bb-grid-size) * 2);
    }
  `;

  render() {
    return html`<slot></slot>`;
  }

  clearContents() {
    const children = Array.from(this.querySelectorAll("*"));
    for (const child of children) {
      child.remove();
    }
  }
}
