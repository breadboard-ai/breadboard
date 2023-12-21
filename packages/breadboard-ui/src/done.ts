/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-done")
export class Done extends LitElement {
  @property()
  message = "Done";

  static styles = css`
    :host {
      display: block;
    }

    div {
      position: relative;
      padding-left: calc(var(--bb-grid-size) * 8);
    }

    div::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      width: calc(var(--bb-grid-size) * 5);
      height: calc(var(--bb-grid-size) * 5);
      background: var(--bb-done-color);
      border-radius: 50%;
    }
  `;

  render() {
    return html`<div>${this.message}</div>`;
  }
}
