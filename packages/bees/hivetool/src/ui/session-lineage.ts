/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { SessionLineageInfo } from "../data/session-store-reader.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesSessionLineage };

@customElement("bees-session-lineage")
class BeesSessionLineage extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: #0f1115;
        border: 1px solid #1e293b;
        border-radius: 8px;
      }

      .lineage-header {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }

      /* Visual Timeline Track Container */
      .sessions-container {
        position: relative;
        padding-left: 22px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      /* Timeline vertical rail line */
      .sessions-container::before {
        content: "";
        position: absolute;
        left: 7px;
        top: 8px;
        bottom: 8px;
        width: 2px;
        background: #1e293b;
      }

      /* Node wrappers on the timeline rail */
      .session-node {
        position: relative;
        width: 100%;
      }

      /* Bullet node points */
      .session-node::before {
        content: "";
        position: absolute;
        left: -20px;
        top: 15px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #1e293b;
        border: 2px solid #0f1115;
        z-index: 2;
        transition: all 0.15s ease;
      }

      /* Bullet state styles */
      .session-node.active::before {
        background: #3b82f6;
        border-color: #0f1115;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
      }

      .session-node.superseded::before {
        background: #475569;
        border-color: #0f1115;
      }

      .session-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 14px;
        background: #14171c;
        border: 1px solid #1e293b;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .session-card:hover {
        background: #1e293b;
        border-color: #334155;
      }

      /* Active session card styling */
      .session-card.selected {
        background: #141924;
        border-color: #3b82f6;
        box-shadow: 0 0 12px rgba(59, 130, 246, 0.25);
      }

      .session-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .session-id {
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.8rem;
        font-weight: 600;
        color: #f8fafc;
      }

      .session-card.selected .session-id {
        color: #60a5fa;
      }

      /* Curated Badge & HSL Palette System */
      .status-badge {
        font-size: 0.65rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .status-badge svg {
        flex-shrink: 0;
      }

      .status-badge svg.spin {
        animation: badgeSpin 1s linear infinite;
      }

      @keyframes badgeSpin {
        to { transform: rotate(360deg); }
      }

      .status-badge.running {
        background: hsla(217, 91%, 60%, 0.12);
        color: hsl(217, 91%, 65%);
        border: 1px solid hsla(217, 91%, 60%, 0.3);
      }

      .status-badge.suspended {
        background: hsla(38, 92%, 50%, 0.12);
        color: hsl(38, 92%, 55%);
        border: 1px solid hsla(38, 92%, 50%, 0.3);
      }

      .status-badge.completed {
        background: hsla(142, 70%, 45%, 0.12);
        color: hsl(142, 70%, 50%);
        border: 1px solid hsla(142, 70%, 45%, 0.3);
      }

      .status-badge.failed {
        background: hsla(0, 84%, 60%, 0.12);
        color: hsl(0, 84%, 65%);
        border: 1px solid hsla(0, 84%, 60%, 0.3);
      }

      .status-badge.superseded {
        background: hsla(215, 16%, 47%, 0.12);
        color: hsl(215, 16%, 55%);
        border: 1px solid hsla(215, 16%, 47%, 0.3);
      }

      .session-meta {
        font-size: 0.7rem;
        color: #64748b;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .fork-info {
        font-style: italic;
        color: #fbbf24;
        font-size: 0.7rem;
      }
    `,
  ];

  @property({ attribute: false })
  accessor lineage: SessionLineageInfo[] = [];

  @property({ type: String })
  accessor activeSessionId: string | null = null;

  @property({ type: String })
  accessor selectedSessionId: string | null = null;

  render() {
    if (this.lineage.length === 0) {
      return html`<div class="empty-state" style="font-size:0.75rem">No session history found</div>`;
    }

    const sortedLineage = this.getSortedLineage();

    return html`
      <div class="lineage-header">
        <span>Session Lineage</span>
        <span style="font-size:0.7rem;color:#64748b">${this.lineage.length} sessions</span>
      </div>
      <div class="sessions-container">
        ${sortedLineage.map((s) => {
          const isActive = s.sessionId === this.activeSessionId;
          const isSelected = s.sessionId === (this.selectedSessionId || this.activeSessionId);
          const forkFromLabel = s.forkedFrom
            ? html`<span class="fork-info">← forked from ${s.forkedFrom.session.slice(0, 8)} at turn ${s.forkedFrom.at_turn}</span>`
            : nothing;

          return html`
            <div class="session-node ${isSelected ? "active" : "superseded"}">
              <div
                class="session-card ${isSelected ? "selected" : ""}"
                @click=${() => this.#onSelect(s.sessionId)}
              >
                <div class="session-card-header">
                  <span class="session-id">
                    ${s.sessionId.slice(0, 13)}...
                    ${isActive ? html`<span style="font-size:0.65rem;color:#60a5fa;font-weight:normal"> (Active)</span>` : nothing}
                  </span>
                  <span class="status-badge ${s.status}">
                    ${this.renderStatusIcon(s.status)}
                    ${s.status}
                  </span>
                </div>
                <div class="session-meta">
                  <span>${s.eventCount} events</span>
                  ${forkFromLabel}
                </div>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private getSortedLineage(): SessionLineageInfo[] {
    const sorted: SessionLineageInfo[] = [];
    const visited = new Set<string>();
    const map = new Map<string, SessionLineageInfo>();
    for (const s of this.lineage) {
      map.set(s.sessionId, s);
    }

    // Find root session(s): those with no forkedFrom, or parent not in list
    const roots = this.lineage.filter(
      (s) => !s.forkedFrom || !map.has(s.forkedFrom.session)
    );

    const visit = (sessionId: string) => {
      if (visited.has(sessionId)) return;
      visited.add(sessionId);

      const s = map.get(sessionId);
      if (s) {
        sorted.push(s);
      }

      // Retrieve children (forked from current sessionId)
      const children = this.lineage.filter(
        (child) => child.forkedFrom?.session === sessionId
      );
      // Sort children by fork turn index
      children.sort((a, b) => (a.forkedFrom?.at_turn ?? 0) - (b.forkedFrom?.at_turn ?? 0));

      for (const child of children) {
        visit(child.sessionId);
      }
    };

    for (const root of roots) {
      visit(root.sessionId);
    }

    // Ensure no session was left out due to isolated references
    for (const s of this.lineage) {
      if (!visited.has(s.sessionId)) {
        sorted.push(s);
      }
    }

    return sorted;
  }

  private renderStatusIcon(status: string) {
    switch (status) {
      case "running":
        return html`
          <svg class="spin" style="width: 8px; height: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.3"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
        `;
      case "suspended":
        return html`
          <svg style="width: 8px; height: 8px;" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="4" width="4" height="16" rx="1"></rect>
            <rect x="15" y="4" width="4" height="16" rx="1"></rect>
          </svg>
        `;
      case "completed":
        return html`
          <svg style="width: 8px; height: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
      case "failed":
        return html`
          <svg style="width: 8px; height: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        `;
      case "superseded":
        return html`
          <svg style="width: 8px; height: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        `;
      default:
        return nothing;
    }
  }

  #onSelect(sessionId: string) {
    this.dispatchEvent(
      new CustomEvent("select-session", {
        detail: { sessionId },
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-session-lineage": BeesSessionLineage;
  }
}
