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
    const pulseTasks = this.sca.controller.global.pulseTasks;

    return html`
      <div class="stage" id="stage">
        ${currentView === null
          ? html`
              <div class="empty">
                ${pulseTasks.length > 0
                  ? html`
                      <div class="status-view">
                        ${pulseTasks.map(
                          (task) => html`
                            <div class="status-row">
                              <span class="status-title">${task.title}</span>
                              <span class="status-badge ${task.status}">
                                ${task.status === "success"
                                  ? "✓"
                                  : task.status === "error"
                                    ? "✕"
                                    : "◇"}
                                ${task.current_step}
                              </span>
                            </div>
                          `
                        )}
                      </div>
                    `
                  : html`
                      <span class="empty-icon">✦</span>
                      <h2>Good morning</h2>
                      <p>
                        Chat with Opie using the bar below, or wait for your
                        digest to appear.
                      </p>
                    `}
              </div>
            `
          : html`
              <iframe
                src="/iframe.html"
                title="Digest View"
                sandbox="allow-scripts allow-same-origin allow-popups"
              ></iframe>
            `}
      </div>
    `;
  }
}
