/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sidebar list of log sessions grouped by parent tasks.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { LogStore } from "../data/log-store.js";
import { getRelativeTime } from "../utils.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesLogList };

@customElement("bees-log-list")
class BeesLogList extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      .jobs-list {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 12px 16px;
      }

      /* Task header container */
      .task-group {
        display: flex;
        flex-direction: column;
        transition: all 0.2s ease;
      }

      .task-group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        background: transparent;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
      }

      .task-group.selected .task-group-header {
        color: #94a3b8;
      }

      .task-title {
        max-width: 220px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Sessions nested list */
      .task-sessions {
        display: flex;
        flex-direction: column;
        padding: 2px 0;
        gap: 4px;
        margin-left: 12px;
      }

      /* Individual session card */
      .session-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        background: transparent;
        border: 1px solid transparent;
        transition: all 0.15s ease;
      }

      .session-card:hover {
        background: #13161c;
      }

      .session-card.selected {
        background: #1e3a5f33;
        border-color: #3b82f644;
      }

      .session-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .session-id {
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.75rem;
        font-weight: 600;
        color: #cbd5e1;
      }

      .session-card.selected .session-id {
        color: #60a5fa;
      }

      .status-badge {
        font-size: 0.6rem;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .status-badge.running {
        background: #1d4ed822;
        color: #60a5fa;
        border: 1px solid #1d4ed866;
      }

      .status-badge.suspended {
        background: #92400e22;
        color: #fbbf24;
        border: 1px solid #92400e66;
      }

      .status-badge.superseded {
        background: #33415522;
        color: #94a3b8;
        border: 1px solid #33415566;
      }

      .session-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.65rem;
        color: #64748b;
      }

      .fork-info {
        font-style: italic;
        color: #fbbf24;
        max-width: 150px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ];

  @property({ attribute: false })
  accessor store: LogStore | null = null;

  /** ID of a recently updated session (for flash animation). */
  @property({ attribute: false })
  accessor flashLogId: string | null = null;

  render() {
    if (!this.store) return nothing;
    const agentGroups = this.store.agentGroups.get();
    const selectedSid = this.store.selectedSessionId.get();
    const selectedAgentId = this.store.selectedAgentId.get();

    if (agentGroups.length === 0) {
      return html`<div class="empty-state">No log sessions found.</div>`;
    }

    return html`
      <div class="jobs-list">
        ${agentGroups.map(
          (group) => html`
            <div class="task-group ${selectedAgentId === group.agentId ? "selected" : ""}">
              <div class="task-group-header">
                <span class="task-title" title="${group.title}">${group.title}</span>
                <div class="job-status ${group.status}"></div>
              </div>
              <div class="task-sessions">
                ${group.sessions.length === 0
                  ? html`<div style="font-size: 0.7rem; color: #475569; padding: 6px 8px; text-align: center;">No active runs</div>`
                  : group.sessions.map((session) => {
                      const isSelected = selectedSid === session.sessionId;
                      const isFlash = this.flashLogId === session.sessionId;
                      const isActive = session.sessionId === group.activeSessionId;

                      const forkFromLabel = session.forkedFrom
                        ? html`<span class="fork-info" title="Forked from ${session.forkedFrom.session.slice(0, 8)} at turn ${session.forkedFrom.at_turn}">
                            ← ${session.forkedFrom.session.slice(0, 8)}:t${session.forkedFrom.at_turn}
                          </span>`
                        : nothing;

                      return html`
                        <div
                          class="session-card ${isSelected ? "selected" : ""} ${isFlash ? "lightning-flash" : ""}"
                          @click=${() => this.handleSelect(session.sessionId)}
                        >
                          <div class="session-card-header">
                            <span class="session-id">
                              ${session.sessionId.slice(0, 13)}...
                              ${isActive ? html`<span style="font-size:0.65rem;color:#60a5fa;font-weight:normal"> (Active)</span>` : nothing}
                            </span>
                            <span class="status-badge ${session.status}">${session.status}</span>
                          </div>
                          <div class="session-meta">
                            <span>${session.eventCount} events</span>
                            ${forkFromLabel}
                            <span>${session.lastModified ? getRelativeTime(new Date(session.lastModified).toISOString()) : ""}</span>
                          </div>
                        </div>
                      `;
                    })}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  private handleSelect(sessionId: string) {
    this.dispatchEvent(
      new CustomEvent("select", { detail: { sessionId }, bubbles: true })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-log-list": BeesLogList;
  }
}
