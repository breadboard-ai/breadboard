/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { AgentStore } from "../data/agent-store.js";
import { getRelativeTime } from "../utils.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesTrajectoryList };

@customElement("bees-trajectory-list")
class BeesTrajectoryList extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      .trajectories-container {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 12px 16px;
      }

      .section-header {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
        margin-bottom: 8px;
      }

      .trajectory-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      /* Individual trajectory card */
      .trajectory-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        background: transparent;
        border: 1px solid transparent;
        transition: all 0.15s ease;
      }

      .trajectory-card:hover {
        background: #13161c;
      }

      .trajectory-card.selected {
        background: #1e3a5f33;
        border-color: #3b82f644;
      }

      .trajectory-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .agent-title {
        font-size: 0.75rem;
        font-weight: 600;
        color: #cbd5e1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 180px;
      }

      .trajectory-card.selected .agent-title {
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

      .status-badge.completed {
        background: #064e3b22;
        color: #34d399;
        border: 1px solid #064e3b66;
      }

      .status-badge.failed {
        background: #7f1d1d22;
        color: #f87171;
        border: 1px solid #7f1d1d66;
      }

      .trajectory-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.65rem;
        color: #64748b;
      }

      .traj-id {
        font-family: "Google Mono", "Roboto Mono", monospace;
        color: #475569;
      }
    `,
  ];

  @property({ attribute: false })
  accessor store: AgentStore | null = null;

  @property({ attribute: false })
  accessor flashTrajId: string | null = null;

  render() {
    if (!this.store) return nothing;
    const trajs = this.store.trajectories.get();
    const selectedId = this.store.selectedTrajectoryAgentId.get();

    if (trajs.length === 0) {
      return html`<div class="empty-state">No trajectories found.</div>`;
    }

    return html`
      <div class="trajectories-container">
        <div class="section-header">Trajectories</div>
        <div class="trajectory-list">
          ${trajs.map((traj) => {
            const isSelected = selectedId === traj.agentId;
            const isFlash = this.flashTrajId === traj.agentId;
            const stepLabel = `${traj.steps.length} step${traj.steps.length !== 1 ? "s" : ""}`;
            const timeLabel = traj.lastModified
              ? getRelativeTime(new Date(traj.lastModified).toISOString())
              : "";

            return html`
              <div
                class="trajectory-card ${isSelected ? "selected" : ""} ${isFlash ? "lightning-flash" : ""}"
                @click=${() => this.handleSelect(traj.agentId)}
              >
                <div class="trajectory-card-header">
                  <span class="agent-title" title="${traj.agentTitle}">
                    ${traj.agentTitle}
                  </span>
                  <span class="status-badge ${traj.agentStatus}">${traj.agentStatus}</span>
                </div>
                <div class="trajectory-meta">
                  <span>${stepLabel}</span>
                  <span class="traj-id" title="Trajectory ID: ${traj.trajectoryId}">
                    ${traj.trajectoryId.slice(0, 8)}...
                  </span>
                  <span>${timeLabel}</span>
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private handleSelect(agentId: string) {
    this.dispatchEvent(
      new CustomEvent("select", { detail: { agentId }, bubbles: true })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-trajectory-list": BeesTrajectoryList;
  }
}
