/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sidebar list of log sessions.
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
      }

      .job-item-group {
        display: flex;
        flex-direction: column;
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
    const sessions = this.store.sessions.get();
    const selectedSid = this.store.selectedSessionId.get();

    if (sessions.length === 0) {
      return html`<div class="empty-state">No log files found.</div>`;
    }

    return html`
      <div class="jobs-list">
        ${sessions.map(
          (session) => html`
            <div class="job-item-group">
              <div
                class="job-item ${selectedSid === session.sessionId
                  ? "selected"
                  : ""} ${this.flashLogId === session.sessionId
                  ? "lightning-flash"
                  : ""}"
                @click=${() => this.handleSelect(session.sessionId)}
              >
                <div class="job-header">
                  <div class="job-title mono">
                    ${session.sessionId.slice(0, 8)}
                  </div>
                  <div class="job-meta" style="margin:0">
                    <span>
                      ${session.files.length}
                      run${session.files.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div class="job-meta">
                  <span>
                    ${getRelativeTime(session.files.at(0)?.startedDateTime)}
                  </span>
                  <span>
                    ${(
                      session.files.reduce((s, f) => s + f.totalTokens, 0) /
                      1000
                    ).toFixed(1)}k
                    tokens
                  </span>
                </div>
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
