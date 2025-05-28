/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("bb-floating-input")
export class FloatingInput extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return html`Floating Input`;
  }
}
