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
import { styles } from "./opal-pulse-bar.styles.js";

@customElement("opal-pulse-bar")
export class OpalPulseBar extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [sharedStyles, styles];

  render() {
    const global = this.sca.controller.global;
    return html`
      <div class="pulse-bar">
        <div class="pulse-content">
          ${global.pulseActive
            ? html`<div class="spinner pulse-bar-spinner"></div>
                <span class="pulse-text">${global.pulseText}</span>`
            : html`<span class="pulse-text pulse-idle"
                >Nothing in progress</span
              >`}
        </div>
        <button
          class="pulse-opie-trigger"
          @click=${() =>
            (this.sca.controller.chat.isOpen =
              !this.sca.controller.chat.isOpen)}
          aria-label="Chat with Opie"
        >
          <span class="pulse-opie-icon">◇</span> Opie
        </button>
      </div>
    `;
  }
}
