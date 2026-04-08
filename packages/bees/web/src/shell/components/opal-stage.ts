/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import { sharedStyles } from "./shared.styles.js";
import { styles as baseStyles } from "./opal-stage.styles.js";
import {
  derivePerspectives,
  deriveChildAgents,
} from "../../sca/utils/agent-tree.js";
import { loadBundleAsync } from "../../sca/utils/load-bundle.js";

import "./opal-timeline.js";
import "./opal-subagent-panel.js";

const stageStyles = css`
  .tab-bar {
    display: flex;
    gap: var(--cg-sp-1, 4px);
    padding: var(--cg-sp-2, 8px) var(--cg-sp-4, 16px);
    background: var(--cg-color-surface-dim, #f5f3f0);
    border-bottom: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    flex-shrink: 0;
  }

  .tab {
    padding: var(--cg-sp-2, 8px) var(--cg-sp-4, 16px);
    border: none;
    background: transparent;
    border-radius: var(--cg-radius-md, 12px);
    font-family: inherit;
    font-size: var(--cg-text-body-md-size, 14px);
    font-weight: 500;
    color: var(--cg-color-on-surface-muted, #79757f);
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
  }

  .tab:hover {
    background: var(--cg-color-surface-bright, #ffffff);
    color: var(--cg-color-on-surface, #1c1b1f);
  }

  .tab.active {
    background: var(--cg-color-primary-container, #dbe1f9);
    color: var(--cg-color-on-primary-container, #0f1b3d);
    font-weight: 600;
  }

  .tab-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .agent-summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--cg-color-on-surface-muted, #79757f);
  }

  .agent-summary-icon {
    font-size: 48px;
    color: var(--cg-color-outline-variant, #e0ddd9);
  }

  .agent-summary h2 {
    font-size: 22px;
    font-weight: 600;
    color: var(--cg-color-on-surface, #1c1b1f);
    letter-spacing: -0.02em;
  }

  .agent-summary p {
    font-size: 14px;
    max-width: 360px;
    text-align: center;
    line-height: 1.6;
  }

  .agent-summary .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--cg-sp-1, 4px) var(--cg-sp-3, 12px);
    border-radius: var(--cg-radius-full, 999px);
    font-size: var(--cg-text-label-md-size, 12px);
    font-weight: 500;
    background: var(--cg-color-surface-container-high, #eae7e3);
    color: var(--cg-color-on-surface-muted, #79757f);
    text-transform: capitalize;
  }
`;

type StageTab = "app" | "subagents";

@customElement("opal-stage")
export class OpalStage extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @state() accessor activeTab: StageTab = "app";

  static styles = [sharedStyles, baseStyles, stageStyles];

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    const iframe = this.renderRoot.querySelector("iframe");
    
    if (iframe && this.sca.controller.stage.currentView !== null) {
      this.sca.services.hostCommunication.connect(iframe);

      if (changedProperties.has("activeTab") && this.activeTab === "app") {
        const selectedId = this.sca.controller.agentTree.selectedAgentId;
        if (selectedId) {
          loadBundleAsync(selectedId, this.sca.services);
        }
      }
    }
  }

  render() {
    const selectedId = this.sca.controller.agentTree.selectedAgentId;

    // No agent selected — fall back to the legacy stage behavior.
    if (!selectedId) {
      return this.#renderLegacyStage();
    }

    const tickets = this.sca.controller.global.tickets;
    const ticket = tickets.find((t) => t.id === selectedId);
    if (!ticket) {
      return this.#renderLegacyStage();
    }

    const perspectives = derivePerspectives(ticket, tickets);
    const tabs: { id: StageTab; label: string }[] = [];

    if (perspectives.hasBundle) tabs.push({ id: "app", label: "App" });
    if (perspectives.hasSubagents)
      tabs.push({ id: "subagents", label: "Subagents" });

    // Auto-select first available tab if current isn't valid.
    const validTabIds = tabs.map((t) => t.id);
    if (!validTabIds.includes(this.activeTab) && tabs.length > 0) {
      this.activeTab = tabs[0].id;
    }

    // No tabs at all — show agent summary.
    if (tabs.length === 0) {
      return html`
        <div class="stage" id="stage">
          ${this.#renderAgentSummary(ticket)}
        </div>
      `;
    }

    // Single tab — no tab bar needed, just render the content.
    if (tabs.length === 1) {
      return html`
        <div class="stage" id="stage">
          <div class="tab-content">
            ${this.#renderTabContent(tabs[0].id, ticket)}
          </div>
        </div>
      `;
    }

    // Multiple tabs — show tab bar.
    return html`
      <div class="stage" id="stage">
        <div class="tab-bar">
          ${tabs.map(
            (tab) => html`
              <button
                class="tab ${this.activeTab === tab.id ? "active" : ""}"
                @click=${() => {
                  this.activeTab = tab.id;
                }}
              >
                ${tab.label}
              </button>
            `
          )}
        </div>
        <div class="tab-content">
          ${this.#renderTabContent(this.activeTab, ticket)}
        </div>
      </div>
    `;
  }

  #renderTabContent(
    tab: StageTab,
    ticket: import("../../data/types.js").TicketData
  ) {
    switch (tab) {
      case "app":
        // Ensure the stage controller knows which ticket to render.
        if (this.sca.controller.stage.currentView !== ticket.id) {
          this.sca.controller.stage.currentView = ticket.id;
        }
        return html`
          <iframe
            src="/iframe.html"
            title="App View"
            sandbox="allow-scripts allow-same-origin allow-popups"
          ></iframe>
        `;
      case "subagents":
        return html`
          <opal-subagent-panel
            .parentTicketId=${ticket.id}
          ></opal-subagent-panel>
        `;
      default:
        return nothing;
    }
  }

  #renderAgentSummary(ticket: import("../../data/types.js").TicketData) {
    const pulseTasks = this.sca.controller.global.pulseTasks;
    const isRunning = pulseTasks.some((pt) => pt.id === ticket.id);
    const title =
      ticket.title ||
      ticket.playbook_id?.replace(/-/g, " ") ||
      ticket.id.slice(0, 8);
    const icon = isRunning ? "⏳" : ticket.status === "completed" ? "✅" : "📋";
    const statusText = isRunning ? "Running" : ticket.status;

    return html`
      <div class="agent-summary">
        <span class="agent-summary-icon">${icon}</span>
        <h2>${title}</h2>
        <div class="status-chip">${statusText}</div>
        <p>
          ${isRunning
            ? "This agent is actively working. Outputs will appear as they become available."
            : ticket.status === "completed"
              ? "This agent has completed its work."
              : "This agent is waiting to begin work."}
        </p>
      </div>
    `;
  }

  /**
   * Legacy stage rendering — used when no agent is selected.
   * Preserves existing digest/empty/iframe/timeline behavior.
   */
  #renderLegacyStage() {
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
