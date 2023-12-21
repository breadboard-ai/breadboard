/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-error")
export class ErrorMessage extends LitElement {
  @property()
  message = "";

  static styles = css`
    :host {
      display: block;
      color: var(--bb-error-color);
    }
  `;

  render() {
    return html`<div>${this.message}</div>`;
  }
}
