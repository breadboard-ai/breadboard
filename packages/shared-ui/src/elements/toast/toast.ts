/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToastRemovedEvent, ToastType } from "../../events/events.js";
import { LitElement, html, css, PropertyValueMap } from "lit";
import { customElement, property } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";
import { classMap } from "lit/directives/class-map.js";

const DEFAULT_TIMEOUT = 8000;

@customElement("bb-toast")
export class Toast extends LitElement {
  @property({ reflect: true })
  accessor toastId: string | null = null;

  @property({ reflect: true })
  accessor type: ToastType = ToastType.INFORMATION;

  @property()
  accessor message = "";

  @property()
  accessor timeout = DEFAULT_TIMEOUT;

  @property()
  accessor offset = 0;

  static styles = [
    colorsLight,
    type,
    icons,
    css`
      :host {
        position: fixed;
        bottom: calc(var(--bb-grid-size) * 10);
        right: calc(var(--bb-grid-size) * 10);
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--n-0);
        color: var(--n-100);
        box-shadow:
          0 2px 3px 0 rgba(0, 0, 0, 0.13),
          0 7px 9px 0 rgba(0, 0, 0, 0.16);
        border-radius: calc(var(--bb-grid-size) * 8);
        padding: var(--bb-grid-size-3) var(--bb-grid-size-6)
          var(--bb-grid-size-3) var(--bb-grid-size-5);
        translate: 0 calc(var(--offset) * var(--bb-grid-size-16) * -1);
        transition: translate 0.2s cubic-bezier(0, 0, 0.3, 1);
        animation: slideIn 0.15s cubic-bezier(0, 0, 0.3, 1) forwards;
        max-width: min(360px, 80vw);
      }

      :host([type="warning"]) {
        color: var(--e-90);
      }

      :host([type="error"]) {
        color: var(--e-80);
      }

      :host(.toasted) {
        animation: slideOut 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
      }

      p {
        margin: 0;
      }

      .g-icon {
        margin-right: var(--bb-grid-size-2);
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
    `,
  ];

  #removalTimeout = -1;
  connectedCallback(): void {
    super.connectedCallback();

    this.removeAfter(this.timeout);
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{ timeout: number }>
      | Map<PropertyKey, unknown>
  ): void {
    if (changedProperties.has("timeout")) {
      if (!this.timeout) {
        this.timeout = DEFAULT_TIMEOUT;
      }

      if (changedProperties.get("timeout") !== this.timeout) {
        this.removeAfter(this.timeout);
      }
    }
  }

  removeAfter(timeout: number) {
    if (timeout === 0) {
      return;
    }

    clearTimeout(this.#removalTimeout);
    this.#removalTimeout = window.setTimeout(() => {
      this.addEventListener(
        "animationend",
        () => {
          this.remove();
          if (this.toastId) {
            this.dispatchEvent(new ToastRemovedEvent(this.toastId));
          }
        },
        { once: true }
      );

      this.classList.add("toasted");
    }, timeout);
  }

  render() {
    if (this.offset !== 0) {
      this.style.setProperty("--offset", this.offset.toString());
    }

    let icon;
    switch (this.type) {
      case ToastType.INFORMATION:
        icon = "info";
        break;
      case ToastType.ERROR:
        icon = "error";
        break;
      case ToastType.WARNING:
        icon = "warning";
        break;
      case ToastType.PENDING:
        icon = "progress_activity";
        break;
    }

    return html` <span
        class=${classMap({
          "g-icon": true,
          round: true,
          filled: true,
          rotate: this.type === ToastType.PENDING,
        })}
        >${icon}</span
      >
      <p class="sans-flex round md-title-small">${this.message}</p>`;
  }
}
