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
      }

      .sessions-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
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

      .session-card.active {
        background: #1e3a5f22;
        border-color: #3b82f6;
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

      .session-card.active .session-id {
        color: #60a5fa;
      }

      .status-badge {
        font-size: 0.65rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .status-badge.running {
        background: #1d4ed822;
        color: #60a5fa;
        border: 1px solid #1d4ed8;
      }

      .status-badge.suspended {
        background: #92400e22;
        color: #fbbf24;
        border: 1px solid #92400e;
      }

      .status-badge.completed {
        background: #065f4622;
        color: #34d399;
        border: 1px solid #065f46;
      }

      .status-badge.failed {
        background: #991b1b22;
        color: #f87171;
        border: 1px solid #991b1b;
      }

      .status-badge.superseded {
        background: #33415544;
        color: #94a3b8;
        border: 1px solid #334155;
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

    return html`
      <div class="lineage-header">
        <span>Session Lineage</span>
        <span style="font-size:0.7rem;color:#64748b">${this.lineage.length} sessions</span>
      </div>
      <div class="sessions-container">
        ${this.lineage.map((s) => {
          const isActive = s.sessionId === this.activeSessionId;
          const isSelected = s.sessionId === (this.selectedSessionId || this.activeSessionId);
          const forkFromLabel = s.forkedFrom
            ? html`<span class="fork-info">← forked from ${s.forkedFrom.session.slice(0, 8)} at turn ${s.forkedFrom.at_turn}</span>`
            : nothing;

          return html`
            <div
              class="session-card ${isSelected ? "active" : ""}"
              @click=${() => this.#onSelect(s.sessionId)}
            >
              <div class="session-card-header">
                <span class="session-id">
                  ${s.sessionId.slice(0, 13)}...
                  ${isActive ? html`<span style="font-size:0.65rem;color:#60a5fa;font-weight:normal"> (Active)</span>` : nothing}
                </span>
                <span class="status-badge ${s.status}">${s.status}</span>
              </div>
              <div class="session-meta">
                <span>${s.eventCount} events</span>
                ${forkFromLabel}
              </div>
            </div>
          `;
        })}
      </div>
    `;
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
