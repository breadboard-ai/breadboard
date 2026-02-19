/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

export { showFakeModeToast };

/**
 * A minimal toast notification for fake mode. Shows an orange banner in the
 * bottom-right corner that auto-dismisses.
 */
@customElement("fake-mode-toast")
class FakeModeToast extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
    }

    div {
      padding: 8px 16px;
      background: #e65100;
      color: #fff;
      border-radius: 8px;
      font:
        14px system-ui,
        sans-serif;
    }
  `;

  @state()
  private accessor _message = "";

  show(message: string) {
    this._message = message;
    setTimeout(() => {
      this._message = "";
    }, 4000);
  }

  override render() {
    return this._message ? html`<div>${this._message}</div>` : nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fake-mode-toast": FakeModeToast;
  }
}

/**
 * Shows a toast message. Automatically creates the `<fake-mode-toast>` element
 * if it's not already in the page.
 */
function showFakeModeToast(message: string): void {
  let el = document.querySelector("fake-mode-toast");
  if (!el) {
    el = document.createElement("fake-mode-toast");
    document.body.appendChild(el);
  }
  el.show(message);
}
