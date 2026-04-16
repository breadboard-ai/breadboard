/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Detail panel for a selected ticket.
 *
 * Renders ticket metadata, identity chips, context, objective, chat
 * history, outcome, error, suspend event, tags, functions, watch events,
 * and the ticket's file tree.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { TicketStore, FileTreeNode } from "../data/ticket-store.js";
import type { MutationClient } from "../data/mutation-client.js";
import type { TemplateStore } from "../data/template-store.js";
import type { SkillStore } from "../data/skill-store.js";
import { sharedStyles } from "./shared-styles.js";
import { renderJson } from "./json-tree.js";
import { jsonTreeStyles } from "./json-tree.styles.js";
import "./truncated-text.js";

export { BeesTicketDetail };

@customElement("bees-ticket-detail")
class BeesTicketDetail extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    jsonTreeStyles,
    css`
      /* ── Chat log ── */
      .chat-log {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 12px;
        max-height: 500px;
        overflow-y: auto;
      }

      .chat-turn {
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 0.8rem;
        line-height: 1.5;
      }

      .chat-turn.user {
        background: #1e293b;
        border: 1px solid #334155;
      }

      .chat-turn.agent {
        background: #111827;
        border: 1px solid #1e293b;
      }

      .chat-role {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 4px;
      }

      .chat-turn.user .chat-role {
        color: #60a5fa;
      }

      .chat-turn.agent .chat-role {
        color: #a78bfa;
      }

      .chat-text {
        color: #e2e8f0;
        white-space: pre-wrap;
        word-break: break-word;
      }

      /* ── File tree ── */
      .file-tree {
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.75rem;
        line-height: 1.4;
        white-space: normal;
        padding: 8px 12px;
      }

      .file-tree details {
        border: none;
        border-radius: 0;
        overflow: visible;
      }

      .file-tree summary {
        cursor: pointer;
        user-select: none;
        padding: 3px 0;
        color: #e2e8f0;
        list-style: none;
        display: flex;
        align-items: center;
        gap: 6px;
        border-radius: 4px;
        padding-left: 4px;
        transition: background 0.1s;
      }

      .file-tree summary:hover {
        background: #1e293b;
      }

      .file-tree summary::-webkit-details-marker {
        display: none;
      }

      .file-dir > summary::before {
        content: "▸";
        color: #475569;
        font-size: 0.6rem;
        width: 10px;
        text-align: center;
        flex-shrink: 0;
      }

      .file-dir[open] > summary::before {
        content: "▾";
      }

      .file-leaf > summary::before {
        content: "";
        width: 10px;
        flex-shrink: 0;
      }

      .file-children {
        margin-left: 16px;
        border-left: 1px solid #1e293b;
        padding-left: 4px;
      }

      .file-content {
        margin: 2px 0 6px 20px;
        padding: 8px 12px;
        background: #0a0b0e;
        border: 1px solid #1e293b;
        border-radius: 6px;
        overflow-x: auto;
        max-height: 400px;
        overflow-y: auto;
        white-space: normal;
      }

      .file-text {
        margin: 0;
        padding: 0;
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.7rem;
        line-height: 1.5;
        color: #cbd5e1;
        white-space: pre-wrap;
        word-break: break-word;
      }

      /* ── Response form ── */

      .response-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .agent-prompt {
        padding: 12px 16px;
        background: #111827;
        border: 1px solid #1e293b;
        border-radius: 8px;
        color: #e2e8f0;
        font-size: 0.85rem;
        line-height: 1.6;
        white-space: pre-wrap;
      }

      .reply-textarea {
        width: 100%;
        min-height: 80px;
        padding: 10px 12px;
        background: #0b0c0f;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #e2e8f0;
        font-family: inherit;
        font-size: 0.85rem;
        resize: vertical;
        outline: none;
        transition: border-color 0.15s;
      }

      .reply-textarea:focus {
        border-color: #3b82f6;
      }

      .reply-textarea::placeholder {
        color: #475569;
      }

      .reply-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .send-btn {
        padding: 6px 16px;
        font-size: 0.8rem;
        font-weight: 600;
        background: #1d4ed8;
        color: #dbeafe;
        border: 1px solid #2563eb;
        border-radius: 6px;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s;
      }

      .send-btn:hover {
        background: #2563eb;
        color: #fff;
      }

      .send-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      /* ── Choice cards ── */

      .choices-grid {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .choice-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: #111827;
        border: 1px solid #1e293b;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
        font-size: 0.8rem;
        color: #e2e8f0;
      }

      .choice-card:hover {
        background: #1e293b;
        border-color: #334155;
      }

      .choice-card.selected {
        background: #1e3a5f;
        border-color: #3b82f6;
      }

      .choice-indicator {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid #475569;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
      }

      .choice-card.selected .choice-indicator {
        border-color: #3b82f6;
        background: #3b82f6;
      }

      .choice-indicator::after {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: transparent;
        transition: background 0.15s;
      }

      .choice-card.selected .choice-indicator::after {
        background: #fff;
      }

      .choice-label {
        flex: 1;
        line-height: 1.4;
      }
    `,
  ];

  @property({ attribute: false })
  accessor ticketStore: TicketStore | null = null;

  @property({ attribute: false })
  accessor mutationClient: MutationClient | null = null;

  @property({ attribute: false })
  accessor templateStore: TemplateStore | null = null;

  @property({ attribute: false })
  accessor skillStore: SkillStore | null = null;

  /** ID of a recently updated ticket (for flash animation). */
  @property({ attribute: false })
  accessor flashTicketId: string | null = null;

  @state() accessor fileTree: FileTreeNode[] = [];
  @state() accessor fileContents: Record<string, string | null> = {};

  // ── Response state ──
  @state() accessor replyText = "";
  @state() accessor selectedChoiceIds = new Set<string>();
  @state() accessor responding = false;

  /** Track the ticket ID we loaded the tree for. */
  #treeLoadedFor: string | null = null;

  render() {
    if (!this.ticketStore) return nothing;
    const ticket = this.ticketStore.selectedTicket.get();
    if (!ticket)
      return html`<div class="empty-state">
        Select a ticket to view details
      </div>`;

    // Reset file tree if ticket changed.
    if (this.#treeLoadedFor !== ticket.id) {
      this.fileTree = [];
      this.fileContents = {};
      this.#treeLoadedFor = ticket.id;
    }

    const suspendFn =
      ticket.suspend_event?.function_name as string | undefined;
    const statusLabel =
      ticket.status === "suspended" &&
      ticket.assignee === "user" &&
      suspendFn !== "chat_await_context_update"
        ? "waiting for user"
        : ticket.status === "suspended"
          ? "waiting for event"
          : ticket.status;

    // Collect identity chips.
    const identityChips: Array<{
      label: string;
      value: string;
      cls?: string;
      onclick?: () => void;
    }> = [];
    if (ticket.model)
      identityChips.push({
        label: "model",
        value: ticket.model,
        cls: "model",
      });
    if (ticket.playbook_id) {
      const templateNames = new Set(
        (this.templateStore?.templates.get() ?? []).map((t) => t.name)
      );
      const exists = templateNames.has(ticket.playbook_id);
      identityChips.push({
        label: "template",
        value: ticket.playbook_id,
        cls: "playbook",
        onclick: exists
          ? () => this.navigate("templates", ticket.playbook_id!)
          : undefined,
      });
    }
    if (ticket.creator_ticket_id)
      identityChips.push({
        label: "parent",
        value: ticket.creator_ticket_id.slice(0, 8),
        onclick: () => this.navigate("tickets", ticket.creator_ticket_id!),
      });
    if (ticket.owning_task_id)
      identityChips.push({
        label: "fs owner",
        value: ticket.owning_task_id.slice(0, 8),
        onclick: () => this.navigate("tickets", ticket.owning_task_id!),
      });
    identityChips.push({
      label: "session",
      value: ticket.id.slice(0, 8),
      onclick: () => this.navigate("logs", ticket.id),
    });
    if (ticket.skills && ticket.skills.length > 0) {
      const skillDirs = new Set(
        (this.skillStore?.skills.get() ?? []).map((sk) => sk.dirName)
      );
      for (const s of ticket.skills)
        identityChips.push({
          label: "skill",
          value: s,
          cls: "skill",
          onclick: skillDirs.has(s)
            ? () => this.navigate("skills", s)
            : undefined,
        });
    }

    const chatHistory = (ticket.chat_history ?? []).filter(
      (m) => m.text.trim() !== ""
    );

    return html`
      <div
        class="job-detail ${this.flashTicketId === ticket.id
          ? "lightning-flash"
          : ""}"
      >
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${ticket.title || "Ticket"}</h2>
            <div class="job-detail-badge ${ticket.status}">${statusLabel}</div>
          </div>
          <div class="job-detail-meta">
            <span
              >ID: <code class="mono">${ticket.id.slice(0, 13)}...</code></span
            >
            <span
              >Created:
              ${new Date(ticket.created_at ?? "").toLocaleString()}</span
            >
            ${ticket.completed_at
              ? html`<span
                  >Completed:
                  ${new Date(ticket.completed_at).toLocaleString()}</span
                >`
              : nothing}
            ${ticket.turns
              ? html`<span>${ticket.turns} turns</span>`
              : nothing}
            ${ticket.thoughts
              ? html`<span>${ticket.thoughts} thoughts</span>`
              : nothing}
          </div>
        </div>

        <div class="timeline">
          ${identityChips.length > 0
            ? html`
                <div class="identity-row">
                  ${identityChips.map(
                    (c) => html`
                      <span
                        class="identity-chip ${c.cls ?? ""} ${c.onclick
                          ? "linkable"
                          : ""}"
                        @click=${c.onclick ?? nothing}
                      >
                        <span class="identity-label">${c.label}</span>
                        ${c.value}
                      </span>
                    `
                  )}
                  ${ticket.playbook_run_id
                    ? html`<span class="identity-chip">
                        <span class="identity-label">run</span>
                        ${ticket.playbook_run_id.slice(0, 8)}
                      </span>`
                    : nothing}
                </div>
              `
            : nothing}
          ${ticket.context
            ? html`
                <div class="context-card">
                  <div class="context-label">Context</div>
                  <bees-truncated-text
                    threshold="300"
                    max-height="150"
                    fadeBg="#111827"
                    >${ticket.context}</bees-truncated-text
                  >
                </div>
              `
            : nothing}
          ${ticket.objective &&
          ticket.objective.trim() !== (ticket.context ?? "").trim()
            ? html`
                <div class="block">
                  <div class="block-header">Objective</div>
                  <div class="block-content">
                    <bees-truncated-text
                      threshold="500"
                      max-height="200"
                      fadeBg="#0f1115"
                      >${ticket.objective}</bees-truncated-text
                    >
                  </div>
                </div>
              `
            : nothing}
          ${chatHistory.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">
                    Chat (${chatHistory.length} messages)
                  </div>
                  <div class="chat-log">
                    ${chatHistory.map(
                      (m) => html`
                        <div
                          class="chat-turn ${m.role === "user"
                            ? "user"
                            : "agent"}"
                        >
                          <div class="chat-role">${m.role}</div>
                          <div class="chat-text">${m.text}</div>
                        </div>
                      `
                    )}
                  </div>
                </div>
              `
            : nothing}
          ${ticket.outcome
            ? html`
                <div class="block outcome">
                  <div class="block-header">Outcome</div>
                  <div class="block-content">
                    <bees-truncated-text
                      threshold="300"
                      max-height="150"
                      fadeBg="#0f1115"
                      >${ticket.outcome}</bees-truncated-text
                    >
                  </div>
                </div>
              `
            : nothing}
          ${ticket.error
            ? html`
                <div class="block error">
                  <div class="block-header">Error</div>
                  <div class="block-content">${ticket.error}</div>
                </div>
              `
            : nothing}
          ${ticket.status === "suspended" && ticket.suspend_event
            ? this.renderSuspendedBlock(ticket.id, ticket.suspend_event, ticket.assignee)
            : nothing}
          ${ticket.tags && ticket.tags.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Tags</div>
                  <div class="block-content">
                    ${ticket.tags.map(
                      (tag) =>
                        html`<span class="tool-badge" style="margin-right:6px"
                          >${tag}</span
                        >`
                    )}
                  </div>
                </div>
              `
            : nothing}
          ${ticket.functions && ticket.functions.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Functions</div>
                  <div class="block-content">
                    ${ticket.functions.map(
                      (fn) =>
                        html`<span class="tool-badge" style="margin-right:6px"
                          >${fn}</span
                        >`
                    )}
                  </div>
                </div>
              `
            : nothing}
          ${ticket.watch_events && ticket.watch_events.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Listening For</div>
                  <div class="block-content">
                    ${ticket.watch_events.map(
                      (ev) =>
                        html`<span
                          class="signal-chip"
                          style="margin-right:6px"
                          >${ev.type}</span
                        >`
                    )}
                  </div>
                </div>
              `
            : nothing}
          ${this.renderFileTree(ticket.id)}
        </div>
      </div>
    `;
  }

  // --- File Tree ---

  private renderFileTree(ticketId: string) {
    const tree = this.fileTree;
    if (tree.length === 0) {
      this.loadFileTree(ticketId);
      return nothing;
    }

    return html`
      <div class="block">
        <div class="block-header">Files</div>
        <div class="file-tree">
          ${tree.map((node) => this.renderFileNode(node, ticketId, []))}
        </div>
      </div>
    `;
  }

  private renderFileNode(
    node: FileTreeNode,
    ticketId: string,
    parentPath: string[]
  ): unknown {
    const currentPath = [...parentPath, node.name];

    if (node.kind === "directory") {
      return html`
        <details class="file-dir">
          <summary>📁 ${node.name}</summary>
          <div class="file-children">
            ${node.children?.map((child) =>
              this.renderFileNode(child, ticketId, currentPath)
            )}
          </div>
        </details>
      `;
    }

    const pathKey = currentPath.join("/");
    const icon = this.fileIcon(node.name);
    const cachedContent = this.fileContents[pathKey];

    return html`
      <details
        class="file-leaf"
        @toggle=${(e: Event) => {
          const det = e.currentTarget as HTMLDetailsElement;
          if (det.open && cachedContent === undefined) {
            this.loadFileContent(ticketId, currentPath, pathKey);
          }
        }}
      >
        <summary>${icon} ${node.name}</summary>
        <div class="file-content">
          ${cachedContent === undefined
            ? html`<div style="color:#64748b;font-size:0.75rem">Loading…</div>`
            : cachedContent === null
              ? html`<div style="color:#64748b;font-size:0.75rem">
                  Unable to read file
                </div>`
              : this.renderFileContent(node.name, cachedContent)}
        </div>
      </details>
    `;
  }

  private renderFileContent(filename: string, content: string): unknown {
    if (filename.endsWith(".json")) {
      try {
        const parsed = JSON.parse(content);
        return html`<div class="json-tree">${renderJson(parsed)}</div>`;
      } catch {
        // Fall through to plain text.
      }
    }
    return html`<pre class="file-text">${content}</pre>`;
  }

  private fileIcon(name: string): string {
    if (name.endsWith(".json")) return "📊";
    if (name.endsWith(".md")) return "📝";
    if (name.endsWith(".py")) return "🐍";
    if (name.endsWith(".ts") || name.endsWith(".js")) return "📜";
    if (name.endsWith(".jsx") || name.endsWith(".tsx")) return "⚛️";
    if (name.endsWith(".css")) return "🎨";
    if (name.endsWith(".html")) return "🌐";
    if (name.endsWith(".mjs")) return "📦";
    return "📄";
  }

  private async loadFileTree(ticketId: string) {
    if (!this.ticketStore) return;
    const tree = await this.ticketStore.readTree(ticketId);
    this.fileTree = tree;
  }

  private async loadFileContent(
    ticketId: string,
    path: string[],
    pathKey: string
  ) {
    if (!this.ticketStore) return;
    const content = await this.ticketStore.readFileContent(ticketId, path);
    this.fileContents = {
      ...this.fileContents,
      [pathKey]: content,
    };
  }

  private navigate(tab: string, id: string) {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { tab, id },
        bubbles: true,
      })
    );
  }

  // ── Suspend / Response ──

  /**
   * Render the suspended block — interactive response form for user-facing
   * suspensions, JSON tree for everything else.
   */
  private renderSuspendedBlock(
    ticketId: string,
    suspendEvent: Record<string, unknown>,
    assignee?: string
  ) {
    const functionName = suspendEvent.function_name as string | undefined;
    const isUserFacing =
      assignee === "user" &&
      functionName !== "chat_await_context_update";

    // For user-facing suspensions, show interactive response UI.
    if (isUserFacing) {
      const waitForInput = suspendEvent.waitForInput as
        | Record<string, unknown>
        | undefined;
      const waitForChoice = suspendEvent.waitForChoice as
        | Record<string, unknown>
        | undefined;

      if (waitForInput) {
        return this.renderReplyForm(ticketId, waitForInput);
      }
      if (waitForChoice) {
        return this.renderChoiceForm(ticketId, waitForChoice);
      }
    }

    // Fallback: raw JSON tree for non-interactive or unknown events.
    const label =
      functionName === "chat_await_context_update"
        ? "Waiting for Event"
        : "Suspended";
    return html`
      <div class="block">
        <div class="block-header">${label}</div>
        <div class="block-content">
          <div class="json-tree">
            ${renderJson(suspendEvent)}
          </div>
        </div>
      </div>
    `;
  }

  /** Extract displayable text from an LLMContent prompt. */
  private extractPromptText(prompt: unknown): string {
    if (!prompt || typeof prompt !== "object") return "";
    const p = prompt as { parts?: Array<{ text?: string }> };
    if (!Array.isArray(p.parts)) return "";
    return p.parts.map((part) => part.text ?? "").join("");
  }

  /** Interactive text reply form for waitForInput suspensions. */
  private renderReplyForm(
    ticketId: string,
    waitForInput: Record<string, unknown>
  ) {
    const promptText = this.extractPromptText(waitForInput.prompt);

    return html`
      <div class="block">
        <div class="block-header">Reply</div>
        <div class="block-content">
          <div class="response-form">
            ${promptText
              ? html`<div class="agent-prompt">${promptText}</div>`
              : nothing}
            <textarea
              class="reply-textarea"
              placeholder="Type your reply…"
              .value=${this.replyText}
              ?disabled=${this.responding}
              @input=${(e: Event) => {
                this.replyText = (e.target as HTMLTextAreaElement).value;
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (this.replyText.trim()) {
                    this.handleTextReply(ticketId);
                  }
                }
              }}
            ></textarea>
            <div class="reply-actions">
              <button
                class="send-btn"
                ?disabled=${!this.replyText.trim() || this.responding}
                @click=${() => this.handleTextReply(ticketId)}
              >
                ${this.responding ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /** Interactive choice selection form for waitForChoice suspensions. */
  private renderChoiceForm(
    ticketId: string,
    waitForChoice: Record<string, unknown>
  ) {
    const promptText = this.extractPromptText(waitForChoice.prompt);
    const choices = (waitForChoice.choices ?? []) as Array<{
      id: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
    const selectionMode =
      (waitForChoice.selectionMode as string) ?? "single";

    return html`
      <div class="block">
        <div class="block-header">Choose</div>
        <div class="block-content">
          <div class="response-form">
            ${promptText
              ? html`<div class="agent-prompt">${promptText}</div>`
              : nothing}
            <div class="choices-grid">
              ${choices.map((choice) => {
                const selected = this.selectedChoiceIds.has(choice.id);
                const label = this.extractPromptText(choice.content) || choice.id;
                return html`
                  <div
                    class="choice-card ${selected ? "selected" : ""}"
                    @click=${() =>
                      this.toggleChoice(choice.id, selectionMode)}
                  >
                    <div class="choice-indicator"></div>
                    <span class="choice-label">${label}</span>
                  </div>
                `;
              })}
            </div>
            <div class="reply-actions">
              <button
                class="send-btn"
                ?disabled=${this.selectedChoiceIds.size === 0 ||
                  this.responding}
                @click=${() => this.handleChoiceReply(ticketId)}
              >
                ${this.responding ? "Sending…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private toggleChoice(choiceId: string, mode: string) {
    const next = new Set(this.selectedChoiceIds);
    if (mode === "single") {
      // Single select: toggle or replace.
      if (next.has(choiceId)) {
        next.clear();
      } else {
        next.clear();
        next.add(choiceId);
      }
    } else {
      // Multiple select: toggle.
      if (next.has(choiceId)) {
        next.delete(choiceId);
      } else {
        next.add(choiceId);
      }
    }
    this.selectedChoiceIds = next;
  }

  private async handleTextReply(ticketId: string) {
    const text = this.replyText.trim();
    if (!text || !this.mutationClient) return;

    this.responding = true;
    try {
      await this.mutationClient.respondToTask(ticketId, { text });
      this.replyText = "";
    } catch (e) {
      console.error("Failed to send reply:", e);
    } finally {
      this.responding = false;
    }
  }

  private async handleChoiceReply(ticketId: string) {
    if (this.selectedChoiceIds.size === 0 || !this.mutationClient) return;

    this.responding = true;
    try {
      await this.mutationClient.respondToTask(ticketId, {
        selectedIds: [...this.selectedChoiceIds],
      });
      this.selectedChoiceIds = new Set();
    } catch (e) {
      console.error("Failed to send choice:", e);
    } finally {
      this.responding = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-ticket-detail": BeesTicketDetail;
  }
}
