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
  deriveAncestorPath,
} from "../../sca/utils/agent-tree.js";

import {
  parseAgentHash,
  updateAgentHash,
} from "../../sca/utils/agent-hash.js";
import { loadBundleAsync } from "../../sca/utils/load-bundle.js";

import "./opal-timeline.js";
import "./opal-subagent-panel.js";

const stageStyles = css`
  /* ── Breadcrumb ── */

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: var(--cg-sp-1, 4px);
    padding: var(--cg-sp-2, 8px) var(--cg-sp-4, 16px);
    background: var(--cg-color-surface-dim, #f5f3f0);
    border-bottom: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    flex-shrink: 0;
    font-size: var(--cg-text-body-sm-size, 12px);
    min-height: 32px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .breadcrumb::-webkit-scrollbar {
    display: none;
  }

  .breadcrumb-segment {
    background: none;
    border: none;
    padding: var(--cg-sp-1, 4px) var(--cg-sp-2, 8px);
    border-radius: var(--cg-radius-sm, 4px);
    font-family: inherit;
    font-size: inherit;
    font-weight: 500;
    color: var(--cg-color-on-surface-muted, #79757f);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .breadcrumb-segment:hover {
    background: var(--cg-color-surface-bright, #ffffff);
    color: var(--cg-color-on-surface, #1c1b1f);
  }

  .breadcrumb-segment.current {
    color: var(--cg-color-on-surface, #1c1b1f);
    font-weight: 600;
    cursor: default;
  }

  .breadcrumb-separator {
    color: var(--cg-color-outline-variant, #e0ddd9);
    font-size: 10px;
    user-select: none;
    flex-shrink: 0;
  }

  /* ── Tabs ── */

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

  /** Track which agent was last rendered so we detect switches. */
  #lastRenderedAgentId: string | null = null;

  static styles = [sharedStyles, baseStyles, stageStyles];

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    const iframe = this.renderRoot.querySelector("iframe");
    
    if (iframe && this.sca.controller.stage.currentView !== null) {
      this.sca.services.hostCommunication.connect(iframe);

      if (changedProperties.has("activeTab") && this.activeTab === "app") {
        const selectedId = this.sca.controller.agentTree.selectedAgentId;
        if (selectedId) {
          const ticket = this.sca.controller.global.tickets.find(
            (t) => t.id === selectedId
          );
          loadBundleAsync(selectedId, this.sca.services, ticket?.slug);
        }
      }
    }
  }

  render() {
    const selectedId = this.sca.controller.agentTree.selectedAgentId;

    // No agent selected — fall back to the legacy stage behavior.
    if (!selectedId) {
      this.#lastRenderedAgentId = null;
      return this.#renderLegacyStage();
    }

    const tickets = this.sca.controller.global.tickets;
    const ticket = tickets.find((t) => t.id === selectedId);
    if (!ticket) {
      // Orphan: selected agent no longer exists — clear selection.
      this.sca.controller.agentTree.selectedAgentId = null;
      return this.#renderLegacyStage();
    }

    const perspectives = derivePerspectives(ticket, tickets);
    const tabs: { id: StageTab; label: string }[] = [];

    if (perspectives.hasBundle) tabs.push({ id: "app", label: "App" });
    if (perspectives.hasSubagents)
      tabs.push({ id: "subagents", label: "Subagents" });

    // On agent switch (or first render), read the hash view.
    // Otherwise, only correct if current tab is invalid.
    const validTabIds = tabs.map((t) => t.id);
    const agentChanged = selectedId !== this.#lastRenderedAgentId;
    this.#lastRenderedAgentId = selectedId;

    if (agentChanged && tabs.length > 0) {
      const { view } = parseAgentHash();
      const hashTab = view as StageTab | null;
      this.activeTab =
        hashTab && validTabIds.includes(hashTab) ? hashTab : tabs[0].id;
    } else if (!validTabIds.includes(this.activeTab) && tabs.length > 0) {
      this.activeTab = tabs[0].id;
    }

    const breadcrumb = this.#renderBreadcrumb(tickets, selectedId);

    // No tabs at all — show agent summary.
    if (tabs.length === 0) {
      return html`
        <div class="stage" id="stage">
          ${breadcrumb}
          ${this.#renderAgentSummary(ticket)}
        </div>
      `;
    }

    // Single tab — no tab bar needed, just render the content.
    if (tabs.length === 1) {
      return html`
        <div class="stage" id="stage">
          ${breadcrumb}
          <div class="tab-content">
            ${this.#renderTabContent(tabs[0].id, ticket)}
          </div>
        </div>
      `;
    }

    // Multiple tabs — show tab bar.
    return html`
      <div class="stage" id="stage">
        ${breadcrumb}
        <div class="tab-bar">
          ${tabs.map(
            (tab) => html`
              <button
                class="tab ${this.activeTab === tab.id ? "active" : ""}"
                @click=${() => {
                  this.activeTab = tab.id;
                  updateAgentHash(selectedId, tab.id);
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

  #renderBreadcrumb(
    tickets: import("../../data/types.js").TicketData[],
    selectedId: string
  ) {
    const path = deriveAncestorPath(tickets, selectedId);
    if (path.length <= 1) return nothing;

    return html`
      <nav class="breadcrumb" aria-label="Agent path">
        ${path.map((id, i) => {
          const t = tickets.find((t) => t.id === id);
          const label =
            t?.title || t?.playbook_id?.replace(/-/g, " ") || id.slice(0, 8);
          const isCurrent = i === path.length - 1;
          return html`
            ${i > 0
              ? html`<span class="breadcrumb-separator">›</span>`
              : nothing}
            <button
              class="breadcrumb-segment ${isCurrent ? "current" : ""}"
              @click=${() => {
                if (!isCurrent) {
                  this.sca.controller.agentTree.selectedAgentId = id;
                }
              }}
              ?disabled=${isCurrent}
            >
              ${label}
            </button>
          `;
        })}
      </nav>
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
