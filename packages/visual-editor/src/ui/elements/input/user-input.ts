/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("bb-user-input")
export class UserInput extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return html`Element`;
  }
}
