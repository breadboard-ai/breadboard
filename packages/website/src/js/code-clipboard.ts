/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-site-toast")
export class Toast extends LitElement {
  @property()
  message = "";

  @property()
  timeout = 8000;

  static styles = css`
    :host {
      position: fixed;
      font-size: 0.75rem;
      bottom: 20px;
      right: 20px;
      display: flex;
      align-items: center;
      background: rgb(255, 255, 255);
      border: 1px solid #ccc;
      box-shadow: 0 2px 3px 0 rgba(0, 0, 0, 0.13),
        0 7px 9px 0 rgba(0, 0, 0, 0.16);
      border-radius: 8px;
      padding: 8px 16px 8px 12px;

      animation: slideIn 0.2s cubic-bezier(0, 0, 0.3, 1) forwards;
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
      animation: slideOut 0.2s cubic-bezier(0, 0, 0.3, 1) forwards;
    }

    :host::before {
      content: "";
      display: inline-block;
      width: 24px;
      height: 24px;
      margin-right: 8px;
      background: url(/breadboard/static/third_party/icons/check-circle.svg)
        center center no-repeat;
      background-size: 24px 24px;
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

@customElement("bb-site-cb-copy")
export class BreadboardSiteClipboardCopy extends LitElement {
  #copying = false;
  static styles = css`
    :host {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 24px;
      height: 24px;

      animation: fadeIn 0.2s cubic-bezier(0, 0, 0.3, 1) 1 forwards;
    }

    button {
      width: 24px;
      height: 24px;
      font-size: 0;
      background: url(/breadboard/static/third_party/icons/copy-to-clipboard.svg)
        center center no-repeat;
      vertical-align: middle;
      border: none;
      cursor: pointer;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
      opacity: 0.5;
      position: absolute;
      border-radius: 50%;
    }

    button:hover {
      opacity: 1;
      transition-duration: 0.1s;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
  `;

  async #copyToClipboard(evt: Event) {
    if (!(evt.target instanceof HTMLButtonElement)) {
      return;
    }
    const content = this.parentElement?.innerText;
    if (!content) {
      return;
    }

    if (this.#copying) {
      return;
    }
    this.#copying = true;
    await navigator.clipboard.writeText(content);
    this.#copying = false;

    const toast = new Toast();
    toast.message = "Copied to clipboard";
    document.body.appendChild(toast);
  }

  render() {
    return html`<button @click=${this.#copyToClipboard}></button>`;
  }
}

export function attachCopy() {
  const codeLinks = document.querySelectorAll("pre");
  for (const code of codeLinks) {
    const copyToClipboard = new BreadboardSiteClipboardCopy();
    code.appendChild(copyToClipboard);
  }
}
