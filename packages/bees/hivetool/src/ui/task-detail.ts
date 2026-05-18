/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Detail panel for a selected task.
 *
 * Renders the full task record: objective, context, outcome, status
 * timeline, and navigable identity chips for assignee and creator.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { AgentStore } from "../data/agent-store.js";
import type { AgentData, TaskItemData } from "../data/types.js";
import { getRelativeTime } from "../utils.js";
import { sharedStyles } from "./shared-styles.js";
import { renderJson } from "./json-tree.js";
import { jsonTreeStyles } from "./json-tree.styles.js";
import "./truncated-text.js";

export { BeesTaskDetail };

@customElement("bees-task-detail")
class BeesTaskDetail extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    jsonTreeStyles,
    css`
      /* ── Metadata field table ── */
      .fields {
        display: grid;
        grid-template-columns: 100px 1fr;
        gap: 0;
        border: 1px solid #1e293b;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 16px;
        font-size: 0.8rem;
      }

      .field-label,
      .field-value {
        padding: 8px 12px;
        border-bottom: 1px solid #1e293b;
      }

      .field-label {
        background: #0c1018;
        color: #64748b;
        font-weight: 600;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        display: flex;
        align-items: center;
      }

      .field-value {
        background: #0a0f1a;
        color: #e2e8f0;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      /* Remove bottom border from last row. */
      .field-label:nth-last-child(2),
      .field-value:last-child {
        border-bottom: none;
      }

      .field-link {
        color: #60a5fa;
        cursor: pointer;
        transition: color 0.15s;
      }

      .field-link:hover {
        color: #93bbfc;
        text-decoration: underline;
      }

      .field-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .field-badge.available {
        background: #92400e33;
        color: #fbbf24;
      }
      .field-badge.in_progress {
        background: #1d4ed833;
        color: #60a5fa;
      }
      .field-badge.completed {
        background: #06603833;
        color: #34d399;
      }
      .field-badge.failed {
        background: #7f1d1d33;
        color: #f87171;
      }
      .field-badge.cancelled {
        background: #33415533;
        color: #94a3b8;
      }

      .field-badge .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      .field-badge.available .status-dot { background: #f59e0b; }
      .field-badge.in_progress .status-dot { background: #3b82f6; }
      .field-badge.completed .status-dot { background: #10b981; }
      .field-badge.failed .status-dot { background: #ef4444; }
      .field-badge.cancelled .status-dot { background: #64748b; }

      .field-mono {
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.75rem;
        color: #94a3b8;
      }

      .field-time {
        color: #cbd5e1;
      }

      .field-time .relative {
        color: #94a3b8;
        margin-left: 4px;
        font-size: 0.7rem;
      }

      /* ── Agent card in field ── */
      .agent-card {
        display: flex;
        flex-direction: column;
        gap: 2px;
        cursor: pointer;
        padding: 2px 0;
      }

      .agent-card:hover .agent-card-title {
        text-decoration: underline;
      }

      .agent-card-title {
        color: #60a5fa;
        font-size: 0.8rem;
        font-weight: 500;
        transition: color 0.15s;
      }

      .agent-card:hover .agent-card-title {
        color: #93bbfc;
      }

      .agent-card-meta {
        font-size: 0.7rem;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .agent-card-meta .sep {
        color: #334155;
      }

      /* ── Dependencies ── */
      .depends-chip {
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.7rem;
        font-family: "Google Mono", "Roboto Mono", monospace;
        background: #1e293b;
        color: #94a3b8;
        border: 1px solid #334155;
        cursor: pointer;
        transition: border-color 0.15s;
      }

      .depends-chip:hover {
        border-color: #60a5fa;
        color: #e2e8f0;
      }

      /* ── Separator ── */
      .section-divider {
        border: none;
        border-top: 1px solid #1e293b;
        margin: 16px 0;
      }

      /* ── Outcome content ── */
      .outcome-parts {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .outcome-parts img {
        max-width: 100%;
        border-radius: 6px;
        border: 1px solid #1e293b;
        display: block;
      }

      .outcome-parts .part-text {
        font-size: 0.8rem;
        color: #e2e8f0;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }
    `,
  ];

  @property({ attribute: false })
  accessor agentStore: AgentStore | null = null;

  render() {
    if (!this.agentStore) return nothing;

    const selectedId = this.agentStore.selectedTaskId.get();
    if (!selectedId) {
      return html`<div class="empty-state">
        Select a task to view details
      </div>`;
    }

    const task = this.agentStore.tasks.get().find((t) => t.id === selectedId);
    if (!task) {
      return html`<div class="empty-state">
        Task not found
      </div>`;
    }

    return this.renderDetail(task);
  }

  private renderDetail(task: TaskItemData) {
    const agents = this.agentStore!.agents.get();

    // Resolve display names for assignee and creator.
    const assigneeAgent = task.assignee
      ? agents.find((a) => a.id === task.assignee)
      : null;
    const creatorAgent = task.created_by
      ? agents.find((a) => a.id === task.created_by)
      : null;

    // No longer need flat labels — renderAgentField handles the full card.

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">
              ${task.title || task.objective?.slice(0, 80) || "Task"}
            </h2>
          </div>
          <div class="job-detail-meta">
            <span class="field-mono">${task.id}</span>
          </div>
        </div>

        <div class="timeline">
          <!-- Metadata fields -->
          <div class="fields">
            <!-- Status -->
            <div class="field-label">Status</div>
            <div class="field-value">
              <span class="field-badge ${task.status}">
                <span class="status-dot"></span>
                ${task.status}
              </span>
            </div>

            <!-- Assignee -->
            <div class="field-label">Assignee</div>
            <div class="field-value">
              ${task.assignee
                ? this.renderAgentField(task.assignee, assigneeAgent)
                : html`<span style="color:#475569">unassigned</span>`}
            </div>

            <!-- Creator -->
            ${task.created_by ? html`
              <div class="field-label">Created by</div>
              <div class="field-value">
                ${this.renderAgentField(task.created_by, creatorAgent)}
              </div>
            ` : nothing}

            <!-- Kind -->
            ${task.kind ? html`
              <div class="field-label">Kind</div>
              <div class="field-value">
                <span class="tool-badge" style="font-size:0.7rem">${task.kind}</span>
              </div>
            ` : nothing}

            <!-- Created -->
            <div class="field-label">Created</div>
            <div class="field-value">
              <span class="field-time">
                ${task.created_at ? new Date(task.created_at).toLocaleString() : "—"}
                <span class="relative">${getRelativeTime(task.created_at)}</span>
              </span>
            </div>

            <!-- Completed -->
            ${task.completed_at ? html`
              <div class="field-label">Completed</div>
              <div class="field-value">
                <span class="field-time">
                  ${new Date(task.completed_at).toLocaleString()}
                  <span class="relative">${getRelativeTime(task.completed_at)}</span>
                </span>
              </div>
            ` : nothing}

            <!-- Tags -->
            ${task.tags && task.tags.length > 0 ? html`
              <div class="field-label">Tags</div>
              <div class="field-value">
                ${task.tags.map(
                  (tag) => html`<span class="tool-badge" style="font-size:0.7rem">${tag}</span>`
                )}
              </div>
            ` : nothing}

            <!-- Dependencies -->
            ${task.depends_on && task.depends_on.length > 0 ? html`
              <div class="field-label">Depends on</div>
              <div class="field-value">
                ${task.depends_on.map(
                  (depId) => html`<span
                    class="depends-chip"
                    @click=${() => {
                      this.agentStore!.selectedTaskId.set(depId);
                    }}
                  >${depId.slice(0, 8)}</span>`
                )}
              </div>
            ` : nothing}
          </div>

          <!-- Objective -->
          ${task.objective
            ? html`
                <div class="block">
                  <div class="block-header">Objective</div>
                  <div class="block-content">
                    <bees-truncated-text
                      threshold="400"
                      max-height="300"
                      fadeBg="#0f1115"
                      >${task.objective}</bees-truncated-text
                    >
                  </div>
                </div>
              `
            : nothing}

          <!-- Context -->
          ${task.context
            ? html`
                <div class="block">
                  <div class="block-header">Context</div>
                  <div class="block-content">
                    <bees-truncated-text
                      threshold="400"
                      max-height="200"
                      fadeBg="#0f1115"
                      >${task.context}</bees-truncated-text
                    >
                  </div>
                </div>
              `
            : nothing}

          <!-- Outcome -->
          ${task.outcome
            ? html`
                <div class="block outcome">
                  <div class="block-header">Outcome</div>
                  <div class="block-content">
                    <bees-truncated-text
                      threshold="400"
                      max-height="300"
                      fadeBg="#0f1115"
                      >${task.outcome}</bees-truncated-text
                    >
                  </div>
                </div>
              `
            : nothing}

          <!-- Outcome content (structured) -->
          ${task.outcome_content
            ? html`
                <div class="block outcome">
                  <div class="block-header">Outcome Content</div>
                  <div class="block-content">
                    ${this.renderOutcomeContent(task.outcome_content)}
                  </div>
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  private navigateTo(tab: string, id: string) {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { tab, id },
        bubbles: true,
      })
    );
  }

  /**
   * Render an agent reference as a rich card inside a metadata field.
   *
   * Shows: title (clickable), type · slug descriptor, and partial UUID.
   * Falls back gracefully when the agent record isn't resolved.
   */
  private renderAgentField(agentId: string, agent: AgentData | null | undefined) {
    const slug = agent?.slug?.split("/").pop();
    const title = agent?.title ?? slug ?? agentId.slice(0, 8);
    const type = agent?.playbook_id;

    // Build descriptor parts: type · slug (if both exist and differ).
    const descriptorParts: string[] = [];
    if (type) descriptorParts.push(type);
    if (slug && slug !== type) descriptorParts.push(slug);

    return html`
      <div
        class="agent-card"
        @click=${() => this.navigateTo("agents", agentId)}
      >
        <span class="agent-card-title">${title}</span>
        ${descriptorParts.length > 0 || agent
          ? html`<span class="agent-card-meta">
              ${descriptorParts.length > 0
                ? descriptorParts.map((p, i) => html`${i > 0 ? html`<span class="sep">·</span>` : nothing}${p}`)
                : nothing}
              ${descriptorParts.length > 0
                ? html`<span class="sep">·</span>`
                : nothing}
              ${agentId.slice(0, 8)}
            </span>`
          : nothing}
      </div>
    `;
  }

  /**
   * Render outcome_content with Gemini content-parts awareness.
   *
   * If the value has a `parts` array (Gemini Content shape), renders
   * text parts as paragraphs and inlineData parts as inline images.
   * Falls back to JSON for anything else.
   */
  private renderOutcomeContent(content: Record<string, unknown>) {
    const parts = content.parts as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(parts) || parts.length === 0) {
      return html`<div class="json-tree">${renderJson(content)}</div>`;
    }

    return html`
      <div class="outcome-parts">
        ${parts.map((part) => {
          // Text part.
          if (typeof part.text === "string") {
            return html`<div class="part-text">${part.text}</div>`;
          }
          // Inline data (image, audio, video).
          const inlineData = part.inlineData as
            | { mimeType: string; data: string }
            | undefined;
          if (inlineData?.data && inlineData?.mimeType) {
            const dataUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`;
            if (inlineData.mimeType.startsWith("image/")) {
              return html`<img src="${dataUrl}" alt="outcome image" />`;
            }
            if (inlineData.mimeType.startsWith("video/")) {
              return html`<video src="${dataUrl}" controls style="max-width:100%;border-radius:6px"></video>`;
            }
            if (inlineData.mimeType.startsWith("audio/")) {
              return html`<audio src="${dataUrl}" controls style="max-width:100%"></audio>`;
            }
          }
          // Unknown part shape — show as JSON tree.
          return html`<div class="json-tree">${renderJson(part)}</div>`;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-task-detail": BeesTaskDetail;
  }
}
