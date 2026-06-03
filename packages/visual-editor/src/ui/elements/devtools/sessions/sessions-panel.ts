/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Sessions panel for devtools — shows a list of backend graph sessions
 * for the current Opal, with status indicators and actions (connect,
 * delete). Selecting a session reconnects the graph UI to that session.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../../sca/context/context.js";
import { type SCA } from "../../../../sca/sca.js";
import type { SessionEntry } from "../../../../sca/controller/subcontrollers/editor/devtools/session-history-controller.js";
import {
  deleteSession,
  startSessionMonitor,
  stopSessionMonitor,
} from "../../../../sca/actions/session/session-actions.js";
import { icons } from "../../../styles/icons.js";

@customElement("bb-devtools-sessions-panel")
export class DevToolsSessionsPanel extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  connectedCallback(): void {
    super.connectedCallback();
    // Start the session monitor if not already running.
    const sessionHistory =
      this.sca.controller.editor.devtools.sessionHistory;
    if (!sessionHistory.monitorAbortController) {
      startSessionMonitor();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    stopSessionMonitor();
  }

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      .session-list {
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size);
        overflow-y: auto;
        flex: 1;
        min-height: 0;
        padding: var(--bb-grid-size);
      }

      .session-item {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size-2);
        border: 1px solid var(--light-dark-n-90);
        background: var(--light-dark-n-100);
        cursor: pointer;
        transition:
          background 0.15s,
          border-color 0.15s;

        &:hover {
          background: var(--light-dark-n-95);
          border-color: var(--light-dark-n-80);
        }

        &.active {
          border-color: var(--light-dark-p-60);
          background: color-mix(
            in srgb,
            var(--light-dark-p-60) 8%,
            var(--light-dark-n-100)
          );
        }
      }

      .session-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .session-id {
        font: 500 var(--bb-label-small) / var(--bb-label-line-height-small)
          var(--bb-font-family-mono, monospace);
        color: var(--light-dark-n-30);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .session-meta {
        font: var(--bb-label-small) / var(--bb-label-line-height-small)
          var(--bb-font-family);
        color: var(--light-dark-n-50);
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;

        &.running {
          background: var(--bb-warning-300, #f59e0b);
          animation: pulse 1.5s ease-in-out infinite;
        }

        &.completed {
          background: var(--bb-done-300, #10b981);
        }

        &.failed,
        &.error {
          background: var(--bb-error-300, #ef4444);
        }

        &.cancelled {
          background: var(--light-dark-n-60);
        }

        &.suspended {
          background: var(--bb-warning-300, #f59e0b);
        }
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.4;
        }
      }

      .delete-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--light-dark-n-50);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--bb-grid-size);
        border-radius: 50%;
        transition:
          background 0.15s,
          color 0.15s;
        flex-shrink: 0;

        &:hover {
          background: var(--bb-error-50, #fef2f2);
          color: var(--bb-error-300, #ef4444);
        }

        & .g-icon {
          font-size: 18px;
        }
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--bb-grid-size-2);
        padding: var(--bb-grid-size-8);
        color: var(--light-dark-n-50);
        font: var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        text-align: center;

        & .g-icon {
          font-size: 32px;
          color: var(--light-dark-n-70);
        }
      }
    `,
  ];

  render() {
    const sessionHistory =
      this.sca.controller.editor.devtools.sessionHistory;
    const sessions = sessionHistory.sessions;
    const activeId = sessionHistory.activeSessionId;

    if (sessions.size === 0) {
      return html`
        <div class="empty-state">
          <span class="g-icon">history</span>
          <span>No sessions yet</span>
          <span style="font-size: 12px; color: var(--light-dark-n-60)"
            >Run an Opal to see session history</span
          >
        </div>
      `;
    }

    // Sort by createdAt descending (newest first).
    const sorted = [...sessions.values()].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    return html`
      <div class="session-list">
        ${sorted.map((session) => this.#renderSession(session, activeId))}
      </div>
    `;
  }

  #renderSession(session: SessionEntry, activeId: string | null) {
    const isActive = session.sessionId === activeId;
    const shortId = session.sessionId.slice(0, 8);
    const time = new Date(session.createdAt * 1000).toLocaleTimeString();

    return html`
      <div
        class="session-item ${isActive ? "active" : ""}"
        @click=${() => this.#onSessionClick(session.sessionId)}
      >
        <span class="status-dot ${session.status}"></span>
        <div class="session-info">
          <span class="session-id" title=${session.sessionId}
            >${shortId}…</span
          >
          <span class="session-meta">
            <span>${session.status}</span>
            <span>·</span>
            <span>${time}</span>
          </span>
        </div>
        ${isActive
          ? html`<span
              class="g-icon"
              style="color: var(--light-dark-p-60); font-size: 18px"
              >link</span
            >`
          : nothing}
        <button
          class="delete-btn"
          title="Delete session"
          @click=${(e: Event) => {
            e.stopPropagation();
            this.#onDeleteClick(session.sessionId);
          }}
        >
          <span class="g-icon">delete</span>
        </button>
      </div>
    `;
  }

  #onSessionClick(sessionId: string) {
    const sessionHistory =
      this.sca.controller.editor.devtools.sessionHistory;

    if (sessionHistory.activeSessionId === sessionId) {
      // Clicking the active session disconnects it.
      sessionHistory.activeSessionId = null;
      sessionHistory.connectionAbortController?.abort();
      sessionHistory.connectionAbortController = null;
    } else {
      // TODO(Phase 11d): connectToSession action.
      sessionHistory.activeSessionId = sessionId;
    }
  }

  #onDeleteClick(sessionId: string) {
    deleteSession(sessionId);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-devtools-sessions-panel": DevToolsSessionsPanel;
  }
}
