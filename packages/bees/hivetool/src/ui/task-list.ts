/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sidebar list of tasks grouped by status.
 *
 * Reads task records from the AgentStore's `tasks` signal and displays
 * them in status-grouped sections: in_progress → available → completed.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { AgentStore } from "../data/agent-store.js";
import type { TaskItemData } from "../data/types.js";
import { getRelativeTime } from "../utils.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesTaskList };

/** Status groups in display order. */
const STATUS_ORDER: Array<{ key: string; label: string }> = [
  { key: "in_progress", label: "In Progress" },
  { key: "available", label: "Available" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
  { key: "cancelled", label: "Cancelled" },
];

@customElement("bees-task-list")
class BeesTaskList extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      .status-group {
        margin-bottom: 4px;
      }

      .status-group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px 4px;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #64748b;
        user-select: none;
      }

      .status-group-count {
        font-size: 0.6rem;
        color: #475569;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 999px;
        background: #1e293b;
      }

      .task-kind {
        font-size: 0.6rem;
        font-weight: 600;
        padding: 1px 5px;
        border-radius: 3px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .task-kind.coordination {
        background: #312e8122;
        color: #818cf8;
        border: 1px solid #312e8166;
      }

      .task-kind.work {
        background: #065f4622;
        color: #34d399;
        border: 1px solid #065f4666;
      }
    `,
  ];

  @property({ attribute: false })
  accessor store: AgentStore | null = null;

  render() {
    if (!this.store) return nothing;
    const tasks = this.store.tasks.get();
    const selectedId = this.store.selectedTaskId.get();

    if (tasks.length === 0) {
      return html`<div class="empty-state">No tasks found.</div>`;
    }

    // Group by status.
    const groups = new Map<string, TaskItemData[]>();
    for (const t of tasks) {
      const key = t.status || "available";
      const list = groups.get(key) ?? [];
      list.push(t);
      groups.set(key, list);
    }

    return html`
      <div class="jobs-list">
        ${STATUS_ORDER.map(({ key, label }) => {
          const items = groups.get(key);
          if (!items || items.length === 0) return nothing;
          return html`
            <div class="status-group">
              <div class="status-group-header">
                <span>${label}</span>
                <span class="status-group-count">${items.length}</span>
              </div>
              ${items.map((t) => this.renderItem(t, selectedId))}
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderItem(t: TaskItemData, selectedId: string | null) {
    const kindClass = t.kind === "coordination" ? "coordination" : "work";

    return html`
      <div
        class="job-item ${selectedId === t.id ? "selected" : ""}"
        @click=${() => this.handleSelect(t.id)}
      >
        <div class="job-header">
          <div class="job-title">
            ${t.title || t.objective?.slice(0, 60) || t.id.slice(0, 8)}
          </div>
          <div class="job-status ${t.status}"></div>
        </div>
        <div class="job-meta">
          <span>
            ${t.kind
              ? html`<span class="task-kind ${kindClass}">${t.kind}</span>`
              : nothing}
            ${t.assignee
              ? html` → <code style="font-size:0.7rem">${t.assignee.slice(0, 8)}</code>`
              : html`<span style="color:#475569">unassigned</span>`}
          </span>
          <span>${getRelativeTime(t.created_at)}</span>
        </div>
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
    "bees-task-list": BeesTaskList;
  }
}
