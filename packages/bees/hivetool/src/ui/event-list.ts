/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sidebar list of coordination events.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { TicketStore } from "../data/ticket-store.js";
import { getRelativeTime } from "../utils.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesEventList };

@customElement("bees-event-list")
class BeesEventList extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  @property({ attribute: false })
  accessor store: TicketStore | null = null;

  @property({ attribute: false })
  accessor selectedEventId: string | null = null;

  render() {
    if (!this.store) return nothing;
    const allTickets = this.store.tickets.get();
    const events = allTickets.filter((t) => t.kind === "coordination");

    if (events.length === 0) {
      return html`<div class="empty-state">No events yet.</div>`;
    }

    return html`
      <div class="jobs-list">
        ${events.map(
          (t) => html`
            <div
              class="job-item ${this.selectedEventId === t.id
                ? "selected"
                : ""}"
              @click=${() => this.handleSelect(t.id)}
            >
              <div class="job-header">
                <div class="job-title">
                  <span class="signal-chip">${t.signal_type}</span>
                </div>
                <div class="job-status ${t.status}"></div>
              </div>
              <div class="job-meta">
                <span
                  style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px"
                  >${t.context ?? ""}</span
                >
                <span>${getRelativeTime(t.created_at)}</span>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  private handleSelect(id: string) {
    this.dispatchEvent(
      new CustomEvent("select", { detail: { id }, bubbles: true })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-event-list": BeesEventList;
  }
}
