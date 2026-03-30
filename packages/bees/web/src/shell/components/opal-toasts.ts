/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import { sharedStyles } from "./shared.styles.js";
import { styles } from "./opal-toasts.styles.js";

@customElement("opal-toasts")
export class OpalToasts extends SignalWatcher(LitElement) {
  static styles = [sharedStyles, styles];
  @consume({ context: scaContext })
  accessor sca!: SCA;

  render() {
    const toasts = this.sca.controller.global.toasts;
    if (toasts.length === 0) return null;

    return html`
      <div
        class="toast-container"
        style="position:fixed; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 1000; display: flex; flex-direction: column; gap: 8px;"
      >
        ${toasts.map(
          (t) => html`
            <div
              class="toast ${t.type}"
              style="background: var(--cg-color-error-container, #ffdce0); color: var(--cg-color-on-error-container, #3b000a); padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 12px; max-width: 400px;"
            >
              <span class="toast-icon" style="font-weight: bold;">✕</span>
              <span
                class="toast-message"
                style="flex:1; font-family: var(--cg-font-mono, monospace); font-size: 14px;"
                >${t.message}</span
              >
              <button
                style="background:none;border:none;color:inherit;cursor:pointer;font-weight:bold;"
                @click=${() => {
                  this.sca.controller.global.toasts =
                    this.sca.controller.global.toasts.filter(
                      (x) => x.id !== t.id
                    );
                }}
              >
                ✕
              </button>
            </div>
          `
        )}
      </div>
    `;
  }
}
