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
import { styles } from "./opal-header.styles.js";
import { navigateToDigest } from "../../sca/actions/stage/stage-actions.js";

@customElement("opal-header")
export class OpalHeader extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [sharedStyles, styles];

  render() {
    const showBack =
      this.sca.controller.stage.currentView !== null &&
      this.sca.controller.stage.currentView !==
        this.sca.controller.stage.digestTicketId;
    return html`
      <header>
        <div class="brand">
          ${showBack
            ? html`<button
                class="back-button"
                @click=${() => navigateToDigest()}
                aria-label="Back to Digest"
              >
                ← Digest
              </button>`
            : html`<span class="brand-icon">◇</span> Opal`}
        </div>
        <div class="actions">
          <a href="/devtools.html">DevTools</a>
        </div>
      </header>
    `;
  }
}
