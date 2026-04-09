/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { provide } from "@lit/context";

import { scaContext } from "../sca/context/context.js";
import { sca as scaInst, type SCA } from "../sca/sca.js";
import { styles } from "./opal-shell.styles.js";

import { parseAgentHash } from "../sca/utils/agent-hash.js";

import "./components/opal-header.js";
import "./components/opal-stage.js";
import "./components/opal-toasts.js";
import "./components/opal-sidebar.js";
import "./components/opal-chat-float.js";

export { OpalShell };

@customElement("opal-shell")
class OpalShell extends SignalWatcher(LitElement) {
  @provide({ context: scaContext })
  accessor sca: SCA = scaInst();

  static styles = [styles];

  connectedCallback() {
    super.connectedCallback();
    this.sca.services.sse.connect();
    this.#restoreAgentFromHash();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.sca.services.sse.close();
    this.sca.services.hostCommunication.dispose();
  }

  render() {
    return html`
      <opal-header></opal-header>
      <div class="shell-workspace">
        <opal-sidebar></opal-sidebar>
        <div class="shell-main-area">
          <opal-stage></opal-stage>
          <opal-chat-float></opal-chat-float>
        </div>
      </div>
      <opal-toasts></opal-toasts>
    `;
  }

  /**
   * Restore agent selection from URL hash after init tickets arrive.
   *
   * Defers the assignment to `setTimeout(0)` so the sync action
   * (`initTickets`) has time to populate `global.tickets` before
   * `syncAgentSelection` reacts and looks up the ticket.
   */
  #restoreAgentFromHash() {
    const { agentId } = parseAgentHash();
    if (!agentId) return;

    // Wait for init_tickets, then defer to next macrotask so the
    // sync action has populated global.tickets.
    this.sca.services.stateEventBus.addEventListener(
      "init_tickets",
      () => {
        setTimeout(() => {
          const exists = this.sca.controller.global.tickets.some(
            (t) => t.id === agentId
          );
          if (exists) {
            this.sca.controller.agentTree.selectedAgentId = agentId;
          } else {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }, 0);
      },
      { once: true }
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "opal-shell": OpalShell;
  }
}
