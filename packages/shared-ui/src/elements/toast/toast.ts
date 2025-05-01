/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToastRemovedEvent, ToastType } from "../../events/events.js";
import { LitElement, html, css, PropertyValueMap } from "lit";
import { customElement, property } from "lit/decorators.js";

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

  static styles = css`
    :host {
      --bb-toast-icon: var(--bb-icon-info);

      position: fixed;
      bottom: calc(var(--bb-grid-size) * 10);
      right: calc(var(--bb-grid-size) * 10);
      display: block;
      background: var(--bb-neutral-0);
      border: 1px solid #ccc;
      box-shadow:
        0 2px 3px 0 rgba(0, 0, 0, 0.13),
        0 7px 9px 0 rgba(0, 0, 0, 0.16);
      border-radius: calc(var(--bb-grid-size) * 8);
      padding: var(--bb-grid-size-3) var(--bb-grid-size-5) var(--bb-grid-size-3)
        var(--bb-grid-size-10);

      translate: 0 calc(var(--offset) * var(--bb-grid-size-16) * -1);
      transition: translate 0.2s cubic-bezier(0, 0, 0.3, 1);
      animation: slideIn 0.15s cubic-bezier(0, 0, 0.3, 1) forwards;
      max-width: min(360px, 80vw);
    }

    :host([type="warning"]) {
      --bb-toast-icon: var(--bb-icon-warning);
      color: var(--bb-boards-600);
    }

    :host([type="error"]) {
      --bb-toast-icon: var(--bb-icon-error);
      color: var(--bb-warning-600);
    }

    :host([type="pending"]) {
      --bb-toast-icon: url(/images/progress-neutral.svg);
    }

    :host(.toasted) {
      animation: slideOut 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
    }

    :host::before {
      content: "";
      position: absolute;
      left: 12px;
      top: 11px;
      width: 20px;
      height: 20px;
      background: var(--bb-toast-icon) center center / 20px 20px no-repeat;
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

    return html`<div>${this.message}</div>`;
  }
}
