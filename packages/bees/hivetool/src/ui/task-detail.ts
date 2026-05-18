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
import type { TaskItemData } from "../data/types.js";
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
      .status-timeline {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .status-step {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.7rem;
        color: #94a3b8;
      }

      .status-step .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .status-step .dot.created { background: #64748b; }
      .status-step .dot.in_progress { background: #3b82f6; }
      .status-step .dot.completed { background: #10b981; }
      .status-step .dot.failed { background: #ef4444; }
      .status-step .dot.available { background: #f59e0b; }

      .status-arrow {
        color: #334155;
        font-size: 0.6rem;
      }

      .depends-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .depends-chip {
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.7rem;
        font-family: "Google Mono", "Roboto Mono", monospace;
        background: #1e293b;
        color: #94a3b8;
        border: 1px solid #334155;
      }

      .outcome-json {
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.75rem;
        white-space: pre-wrap;
        word-break: break-all;
        color: #cbd5e1;
        padding: 8px 12px;
        background: #0b0c0f;
        border-radius: 6px;
        border: 1px solid #1e293b;
        max-height: 300px;
        overflow-y: auto;
      }

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

    const assigneeLabel = assigneeAgent?.slug?.split("/").pop()
      ?? assigneeAgent?.title;
    const assigneeName = assigneeLabel
      ? `${assigneeLabel} (${task.assignee!.slice(0, 8)})`
      : task.assignee?.slice(0, 8);
    const creatorLabel = creatorAgent?.slug?.split("/").pop()
      ?? creatorAgent?.title;
    const creatorName = creatorLabel
      ? `${creatorLabel} (${task.created_by!.slice(0, 8)})`
      : task.created_by?.slice(0, 8);

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">
              ${task.title || task.objective?.slice(0, 80) || "Task"}
            </h2>
            <div class="job-detail-badge ${task.status}">${task.status}</div>
          </div>
          <div class="job-detail-meta">
            <span>ID: <code class="mono">${task.id.slice(0, 13)}...</code></span>
            <span>Created: ${task.created_at ? new Date(task.created_at).toLocaleString() : "—"}</span>
            ${task.completed_at
              ? html`<span>Completed: ${new Date(task.completed_at).toLocaleString()}</span>`
              : nothing}
          </div>
        </div>

        <div class="timeline">
          <!-- Identity chips -->
          <div class="identity-row">
            ${task.assignee
              ? html`
                  <span
                    class="identity-chip linkable"
                    @click=${() => this.navigateTo("agents", task.assignee!)}
                  >
                    <span class="identity-label">assignee</span>
                    ${assigneeName}
                  </span>
                `
              : html`
                  <span class="identity-chip">
                    <span class="identity-label">assignee</span>
                    unassigned
                  </span>
                `}
            ${task.created_by
              ? html`
                  <span
                    class="identity-chip linkable"
                    @click=${() => this.navigateTo("agents", task.created_by!)}
                  >
                    <span class="identity-label">creator</span>
                    ${creatorName}
                  </span>
                `
              : nothing}
            ${task.kind
              ? html`
                  <span class="identity-chip ${task.kind === "coordination" ? "playbook" : ""}">
                    <span class="identity-label">kind</span>
                    ${task.kind}
                  </span>
                `
              : nothing}
          </div>

          <!-- Status timeline -->
          <div class="block">
            <div class="block-header">Lifecycle</div>
            <div class="block-content">
              <div class="status-timeline">
                <span class="status-step">
                  <span class="dot created"></span>
                  created ${getRelativeTime(task.created_at)}
                </span>
                ${task.assignee ? html`
                  <span class="status-arrow">→</span>
                  <span class="status-step">
                    <span class="dot in_progress"></span>
                    assigned
                  </span>
                ` : nothing}
                ${task.completed_at ? html`
                  <span class="status-arrow">→</span>
                  <span class="status-step">
                    <span class="dot ${task.status}"></span>
                    ${task.status} ${getRelativeTime(task.completed_at)}
                  </span>
                ` : nothing}
              </div>
            </div>
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

          <!-- Tags -->
          ${task.tags && task.tags.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Tags</div>
                  <div class="block-content">
                    <div class="identity-row">
                      ${task.tags.map(
                        (tag) => html`<span class="tool-badge" style="font-size:0.7rem">${tag}</span>`
                      )}
                    </div>
                  </div>
                </div>
              `
            : nothing}

          <!-- Dependencies -->
          ${task.depends_on && task.depends_on.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Depends On</div>
                  <div class="block-content">
                    <div class="depends-list">
                      ${task.depends_on.map(
                        (depId) => html`
                          <span
                            class="depends-chip"
                            style="cursor:pointer"
                            @click=${() => {
                              this.agentStore!.selectedTaskId.set(depId);
                            }}
                          >${depId.slice(0, 8)}</span>
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

  private navigateTo(tab: string, id: string) {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { tab, id },
        bubbles: true,
      })
    );
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
