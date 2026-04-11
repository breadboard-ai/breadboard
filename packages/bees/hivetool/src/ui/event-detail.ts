/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Detail panel for a selected coordination event.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { TicketStore } from "../data/ticket-store.js";
import { sharedStyles } from "./shared-styles.js";
import "./truncated-text.js";

export { BeesEventDetail };

@customElement("bees-event-detail")
class BeesEventDetail extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      .delivered-to {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .delivered-to-id {
        padding: 2px 6px;
        background: #1e293b;
        color: #94a3b8;
        border-radius: 4px;
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.7rem;
      }
    `,
  ];

  @property({ attribute: false })
  accessor ticketStore: TicketStore | null = null;

  @property({ attribute: false })
  accessor selectedEventId: string | null = null;

  render() {
    if (!this.ticketStore || !this.selectedEventId)
      return html`<div class="empty-state">
        Select an event to inspect
      </div>`;

    const allTickets = this.ticketStore.tickets.get();
    const event = allTickets.find(
      (t) => t.id === this.selectedEventId && t.kind === "coordination"
    );
    if (!event)
      return html`<div class="empty-state">
        Select an event to inspect
      </div>`;

    // Resolve delivered-to IDs to ticket titles.
    const resolveTitle = (id: string): string => {
      const t = allTickets.find((tk) => tk.id === id);
      return t?.title ?? id.slice(0, 8);
    };

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">
              <span class="signal-chip">${event.signal_type}</span>
            </h2>
          </div>
          <div class="job-detail-meta">
            <span
              >ID: <code class="mono">${event.id.slice(0, 13)}...</code></span
            >
            <span>${new Date(event.created_at ?? "").toLocaleString()}</span>
          </div>
        </div>

        <div class="timeline">
          ${event.context
            ? html`
                <div class="context-card">
                  <div class="context-label">Signal Context</div>
                  <bees-truncated-text
                    threshold="300"
                    max-height="150"
                    fadeBg="#111827"
                    >${event.context}</bees-truncated-text
                  >
                </div>
              `
            : nothing}
          ${event.delivered_to && event.delivered_to.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Delivered To</div>
                  <div class="block-content">
                    <div class="delivered-to">
                      ${event.delivered_to.map(
                        (id) => html`
                          <span class="delivered-to-id"
                            >${resolveTitle(id)}</span
                          >
                        `
                      )}
                    </div>
                  </div>
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-event-detail": BeesEventDetail;
  }
}
