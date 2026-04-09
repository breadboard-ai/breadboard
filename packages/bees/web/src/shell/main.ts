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
import { selectAgent } from "../sca/actions/tree/tree-actions.js";
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

  private pulseTimeout: ReturnType<typeof setTimeout> | null = null;
  static styles = [styles];

  connectedCallback() {
    super.connectedCallback();
    this.sca.services.sse.connect();
    this.#pollPulseLoop();
    this.#restoreAgentFromHash();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.sca.services.sse.close();
    this.sca.services.hostCommunication.dispose();
    if (this.pulseTimeout) clearTimeout(this.pulseTimeout);
  }

  async #pollPulseLoop() {
    await this.#pollPulse();
    this.pulseTimeout = setTimeout(() => this.#pollPulseLoop(), 5_000);
  }

  async #pollPulse() {
    try {
      const pulse = await this.sca.services.api.getPulse();
      const global = this.sca.controller.global;
      global.pulseText = pulse.text;
      global.pulseTasks = pulse.tasks || [];
    } catch (e) {
      console.error("[opal-shell] Pulse poll failed:", e);
    }
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
   * Defers `selectAgent` to `setTimeout(0)` so the sync action
   * (`initTickets`) has time to populate `global.tickets` before
   * selectAgent tries to look up the ticket for chat/bundle setup.
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
            selectAgent(new CustomEvent("select", { detail: agentId }));
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
