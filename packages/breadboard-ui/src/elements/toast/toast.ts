/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToastType } from "../../events/events.js";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-toast")
export class Toast extends LitElement {
  @property({ reflect: true })
  type: ToastType = ToastType.INFORMATION;

  @property()
  message = "";

  @property()
  timeout = 8000;

  static styles = css`
    :host {
      --bb-toast-icon: var(--bb-icon-info);

      position: fixed;
      bottom: calc(var(--bb-grid-size) * 10);
      right: calc(var(--bb-grid-size) * 10);
      display: block;
      background: rgb(255, 255, 255);
      border: 1px solid #ccc;
      box-shadow: 0 2px 3px 0 rgba(0, 0, 0, 0.13),
        0 7px 9px 0 rgba(0, 0, 0, 0.16);
      border-radius: calc(var(--bb-grid-size) * 8);
      padding: calc(var(--bb-grid-size) * 5) calc(var(--bb-grid-size) * 8)
        calc(var(--bb-grid-size) * 5) calc(var(--bb-grid-size) * 12);

      animation: slideIn var(--bb-easing-duration-in) var(--bb-easing) forwards;
      max-width: min(360px, 80vw);
    }

    :host([type="warning"]) {
      --bb-toast-icon: var(--bb-icon-warning);
      color: var(--bb-warning-color);
    }

    :host([type="error"]) {
      --bb-toast-icon: var(--bb-icon-error);
      color: var(--bb-error-color);
    }

    :host(.toasted) {
      animation: slideOut var(--bb-easing-duration-out) var(--bb-easing)
        forwards;
    }

    :host::before {
      content: "";
      position: absolute;
      left: 16px;
      top: 17px;
      width: 24px;
      height: 24px;
      background: var(--bb-toast-icon) center center no-repeat;
    }

    @keyframes slideIn {
      from {
        transform: translateY(20px);
        opacity: 0;
      }

      to {
        transform: none;
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: none;
        opacity: 1;
      }

      to {
        transform: translateY(-20px);
        opacity: 0;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    setTimeout(() => {
      this.addEventListener(
        "animationend",
        () => {
          this.remove();
        },
        { once: true }
      );

      this.classList.add("toasted");
    }, this.timeout);
  }

  render() {
    return html`<div>${this.message}</div>`;
  }
}
