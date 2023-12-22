/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-progress")
export class Progress extends LitElement {
  @property()
  message = "";

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
      background: radial-gradient(
          var(--bb-progress-color) 0%,
          var(--bb-progress-color) 30%,
          var(--bb-progress-color-faded) 30%,
          var(--bb-progress-color-faded) 50%,
          transparent 50%,
          transparent 100%
        ),
        conic-gradient(transparent 0deg, var(--bb-progress-color) 360deg),
        linear-gradient(
          var(--bb-progress-color-faded),
          var(--bb-progress-color-faded)
        );

      border-radius: 50%;
      animation: rotate 0.5s linear infinite;
    }

    @keyframes rotate {
      from {
        transform: rotate(0);
      }

      to {
        transform: rotate(360deg);
      }
    }
  `;

  render() {
    return html`<div>${this.message}</div>`;
  }
}
