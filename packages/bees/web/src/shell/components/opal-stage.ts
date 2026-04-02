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
import { styles } from "./opal-stage.styles.js";

import "./opal-timeline.js";

@customElement("opal-stage")
export class OpalStage extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [sharedStyles, styles];

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    const iframe = this.renderRoot.querySelector("iframe");
    if (iframe && this.sca.controller.stage.currentView !== null) {
      this.sca.services.hostCommunication.connect(iframe);
    }
  }

  render() {
    const currentView = this.sca.controller.stage.currentView;
    const isBundle =
      currentView !== null &&
      this.sca.controller.global.tickets
        .find((t) => t.id === currentView)
        ?.tags?.includes("bundle");

    return html`
      <div class="stage" id="stage">
        ${currentView === null
          ? html`
              <div class="empty">
                <span class="empty-icon">✦</span>
                <h2>Clean Slate</h2>
                <p>Start a new journey below.</p>
              </div>
            `
          : currentView === "digest" ||
              (currentView === this.sca.controller.stage.digestTicketId &&
                !isBundle)
            ? html`
                <div class="empty">
                  <span class="empty-icon">⏳</span>
                  <h2>Curating Your Digest</h2>
                  <p>
                    Opie is gathering observations from your active journeys. It
                    will appear here soon.
                  </p>
                </div>
              `
            : isBundle
              ? html`
                  <iframe
                    src="/iframe.html"
                    title="Digest View"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                  ></iframe>
                `
              : html`
                  <opal-timeline .ticketId=${currentView}></opal-timeline>
                `}
      </div>
    `;
  }
}
