/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import { sharedStyles } from "./shared.styles.js";

import { markdown } from "../../directives/markdown.js";

const styles = css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background: var(--cg-color-surface, #fdfcfa);
    padding: var(--cg-sp-10, 40px) var(--cg-sp-12, 48px);
    box-sizing: border-box;
  }

  .timeline-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--cg-sp-8, 32px);
    padding-bottom: var(--cg-sp-4, 16px);
    border-bottom: 1px solid var(--cg-color-outline-variant, #e0ddd9);
  }

  .title {
    font-size: var(--cg-text-headline-sm-size, 24px);
    font-weight: 600;
    color: var(--cg-color-on-surface, #1c1b1f);
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: var(--cg-sp-1, 4px) var(--cg-sp-3, 12px);
    background: var(--cg-color-primary-container, #dbe1f9);
    color: var(--cg-color-on-primary-container, #0f1b3d);
    border-radius: var(--cg-radius-full, 999px);
    font-size: var(--cg-text-label-md-size, 12px);
    font-weight: 500;
  }

  .status-badge.active {
    background: #ff980022;
    color: #e65100;
    box-shadow: 0 0 0 1px #ff980066;
  }

  .markdown-content {
    background: var(--cg-color-surface-container-lowest, #ffffff);
    padding: var(--cg-sp-6, 24px);
    border-radius: var(--cg-radius-lg, 16px);
    border: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    font-size: var(--cg-text-body-lg-size, 16px);
    line-height: var(--cg-text-body-lg-line-height, 24px);
    color: var(--cg-color-on-surface, #1c1b1f);
  }

  .markdown-content h1,
  .markdown-content h2,
  .markdown-content h3 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
  }

  .markdown-content h1:first-child {
    margin-top: 0;
  }

  .markdown-content p {
    margin-bottom: 1em;
  }

  .markdown-content ul,
  .markdown-content ol {
    margin-bottom: 1em;
    padding-left: 1.5em;
  }

  .context-meta {
    margin-top: var(--cg-sp-8, 32px);
    padding: var(--cg-sp-4, 16px);
    background: var(--cg-color-surface-container-low, #f8f6f3);
    border-radius: var(--cg-radius-md, 12px);
    font-size: var(--cg-text-body-md-size, 14px);
    color: var(--cg-color-on-surface-muted, #79757f);
  }

  .dot-flashing {
    position: relative;
    width: 6px;
    height: 6px;
    border-radius: 5px;
    background-color: currentColor;
    color: currentColor;
    animation: dot-flashing 1s infinite linear alternate;
    animation-delay: 0.5s;
    margin-left: 12px;
    margin-right: 12px;
  }
  .dot-flashing::before,
  .dot-flashing::after {
    content: "";
    display: inline-block;
    position: absolute;
    top: 0;
  }
  .dot-flashing::before {
    left: -10px;
    width: 6px;
    height: 6px;
    border-radius: 5px;
    background-color: currentColor;
    color: currentColor;
    animation: dot-flashing 1s infinite alternate;
    animation-delay: 0s;
  }
  .dot-flashing::after {
    left: 10px;
    width: 6px;
    height: 6px;
    border-radius: 5px;
    background-color: currentColor;
    color: currentColor;
    animation: dot-flashing 1s infinite alternate;
    animation-delay: 1s;
  }

  @keyframes dot-flashing {
    0% {
      opacity: 0.2;
    }
    50%,
    100% {
      opacity: 1;
    }
  }

  .empty-state {
    opacity: 0.6;
    text-align: center;
    padding: var(--cg-sp-12, 48px) 0;
  }

  .empty-icon {
    font-size: var(--cg-text-display-sm-size, 24px);
    display: block;
    margin-bottom: var(--cg-sp-4, 16px);
  }
`;

@customElement("opal-timeline")
export class OpalTimeline extends SignalWatcher(LitElement) {
  static styles = [sharedStyles, styles];

  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property({ type: String })
  accessor ticketId!: string;

  render() {
    if (!this.ticketId) return null;

    const ticket = this.sca.controller.global.tickets.find(
      (t) => t.id === this.ticketId
    );
    if (!ticket) return null;

    const pulseTask = this.sca.controller.global.pulseTasks.find(
      (pt) => pt.id === this.ticketId
    );
    const isRunning = pulseTask !== undefined;

    // The thread sets the overall human-readable title (e.g. "Laptop Finder")
    const thread = this.sca.controller.chat.threads.find(
      (t) =>
        t.activeTicketId === this.ticketId ||
        t.ticketIds.includes(this.ticketId)
    );
    const headerTitle = thread?.title || ticket.title || "Working...";

    const isAwaitingUser =
      !isRunning && ticket.status === "suspended" && ticket.assignee === "user";

    let badgeHtml = html`<div class="status-badge">Complete</div>`;
    if (isRunning) {
      badgeHtml = html`
        <div class="status-badge active">
          ${pulseTask.current_step || "Running"}
          <div class="dot-flashing"></div>
        </div>
      `;
    } else if (isAwaitingUser) {
      badgeHtml = html`<div
        class="status-badge"
        style="background: var(--cg-color-primary-container); color: var(--cg-color-primary);"
      >
        Waiting for you
      </div>`;
    } else if (ticket.status === "failed") {
      badgeHtml = html`<div
        class="status-badge"
        style="background: var(--cg-color-error-container); color: var(--cg-color-error);"
      >
        Failed
      </div>`;
    } else if (ticket.status === "suspended" || ticket.status === "available") {
      badgeHtml = html`<div
        class="status-badge"
        style="background: var(--cg-color-surface-container-high); color: var(--cg-color-on-surface-muted);"
      >
        Working...
      </div>`;
    }

    // Gather worker tickets that share this journey's workspace.
    // Child workers get parent_run_id = the caller's playbook_run_id,
    // so we match against this ticket's playbook_run_id.
    const runId = ticket.playbook_run_id;
    const workerTickets = runId
      ? this.sca.controller.global.tickets
          .filter(
            (t) =>
              t.parent_run_id === runId &&
              t.kind !== "coordination" &&
              t.playbook_id &&
              t.id !== this.ticketId &&
              !t.tags?.includes("chat") &&
              !t.tags?.includes("digest")
          )
          .sort((a, b) =>
            (a.created_at || "").localeCompare(b.created_at || "")
          )
      : [];

    // Try finding the latest question to display big on the timeline
    let latestQuestion = null;
    if (isAwaitingUser && thread) {
      const messages =
        this.sca.controller.chat.threadMessages.get(thread.id) || [];
      const agentMessages = messages.filter((m) => m.role === "agent");
      latestQuestion = agentMessages[agentMessages.length - 1]?.text;
    }

    return html`
      <div class="timeline-container">
        <div class="timeline-header">
          <div class="title">${headerTitle}</div>
          ${badgeHtml}
        </div>

        ${workerTickets.length > 0
          ? html`
              <div
                class="worker-events-list"
                style="margin-bottom: var(--cg-sp-8, 32px);"
              >
                ${workerTickets.map((wt) => {
                  const isWorkerRunning = wt.status === "running";
                  const icon =
                    wt.status === "completed"
                      ? "✅"
                      : wt.status === "failed"
                        ? "❌"
                        : isWorkerRunning
                          ? "⏳"
                          : "📝";
                  return html`
                    <div
                      style="padding: var(--cg-sp-3, 12px) var(--cg-sp-4, 16px); margin-bottom: var(--cg-sp-2, 8px); background: var(--cg-color-surface-container-low, #f8f6f3); border-radius: var(--cg-radius-md, 8px); display: flex; align-items: center; gap: var(--cg-sp-3, 12px); font-size: var(--cg-text-body-sm-size, 14px);"
                    >
                      <span
                        style="font-size: var(--cg-text-title-md-size, 16px);"
                        >${icon}</span
                      >
                      <strong
                        style="color: var(--cg-color-on-surface); text-transform: capitalize;"
                        >${wt.playbook_id
                          ?.replace("atomic-", "")
                          .replace("-", " ") || "Worker"}</strong
                      >
                      <span
                        style="color: var(--cg-color-on-surface-muted); margin-left: auto;"
                        >${isWorkerRunning ? "In progress..." : wt.status}</span
                      >
                      ${isWorkerRunning
                        ? html`<div
                            class="dot-flashing"
                            style="margin: 0; margin-left: 4px;"
                          ></div>`
                        : ""}
                    </div>
                  `;
                })}
              </div>
            `
          : null}
        ${latestQuestion
          ? html`
              <div
                class="agent-prompt-bubble"
                style="margin: 0; background: var(--cg-color-surface-container-high); padding: var(--cg-sp-6, 24px); border-radius: var(--cg-radius-lg, 16px); border: 1px solid var(--cg-color-outline-variant); font-size: var(--cg-text-body-lg-size, 16px); line-height: var(--cg-text-body-lg-line-height, 24px);"
              >
                ${markdown(latestQuestion)}
              </div>
            `
          : workerTickets.length === 0
            ? html`
                <div class="empty-state">
                  <span class="empty-icon"
                    >${isRunning ? "⏳" : isAwaitingUser ? "💬" : "📝"}</span
                  >
                  ${isRunning
                    ? pulseTask?.title
                      ? `Actively working on ${pulseTask.title}...`
                      : "Actively working..."
                    : isAwaitingUser
                      ? "Awaiting your response below..."
                      : "No outputs available yet."}
                </div>
              `
            : null}
      </div>
    `;
  }
}
