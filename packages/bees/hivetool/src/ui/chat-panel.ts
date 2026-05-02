/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unified chat panel — chat log + interactive input UI.
 *
 * Renders the conversation history from `ticket.chat_history` and,
 * when the task is suspended waiting for user input, shows a text
 * reply form or choice selection cards.
 *
 * This component is a built-in surface item composed by
 * `<bees-surface-pane>`, not driven by `surface.json`.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { TicketStore } from "../data/ticket-store.js";
import type { MutationClient } from "../data/mutation-client.js";
import type { TaskData } from "../../../common/types.js";
import { markdown } from "../../../common/markdown.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesChatPanel };

@customElement("bees-chat-panel")
class BeesChatPanel extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      /* ── Chat log ── */
      .chat-log {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 12px;
        flex: 1;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #334155 transparent;
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
      }

      .chat-text p {
        margin: 0.3em 0;
      }

      .chat-text p:first-child {
        margin-top: 0;
      }

      .chat-text p:last-child {
        margin-bottom: 0;
      }

      .chat-text code {
        background: #1e293b;
        padding: 1px 5px;
        border-radius: 3px;
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.85em;
      }

      .chat-text pre {
        background: #0f172a;
        border: 1px solid #1e293b;
        border-radius: 4px;
        padding: 8px 12px;
        overflow-x: auto;
        margin: 0.5em 0;
      }

      .chat-text pre code {
        background: none;
        padding: 0;
        font-size: 0.8rem;
      }

      .chat-text ul,
      .chat-text ol {
        margin: 0.4em 0;
        padding-left: 1.5em;
      }

      .chat-text a {
        color: #60a5fa;
      }

      .chat-text strong {
        color: #f8fafc;
      }

      /* ── Response form ── */

      .response-section {
        border-top: 1px solid #1e293b;
        padding: 12px;
        flex-shrink: 0;
      }

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
      }

      .agent-prompt p {
        margin: 0.3em 0;
      }

      .agent-prompt p:first-child {
        margin-top: 0;
      }

      .agent-prompt p:last-child {
        margin-bottom: 0;
      }

      .agent-prompt code {
        background: #1e293b;
        padding: 1px 5px;
        border-radius: 3px;
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.85em;
      }

      .agent-prompt strong {
        color: #f8fafc;
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
        box-sizing: border-box;
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

      /* ── Empty state ── */
      .chat-empty {
        padding: 24px;
        text-align: center;
        color: #475569;
        font-size: 0.8rem;
        font-style: italic;
      }
    `,
  ];

  @property({ attribute: false })
  accessor ticketStore: TicketStore | null = null;

  @property({ attribute: false })
  accessor mutationClient: MutationClient | null = null;

  @state() accessor replyText = "";
  @state() accessor selectedChoiceIds = new Set<string>();
  @state() accessor responding = false;

  /**
   * Whether this panel has visible content — chat messages or pending
   * user input. Used by the parent to decide grid layout.
   */
  get hasContent(): boolean {
    const ticket = this.ticketStore?.selectedTicket.get();
    if (!ticket) return false;
    return hasChatContent(ticket);
  }

  render() {
    if (!this.ticketStore) return nothing;
    const ticket = this.ticketStore.selectedTicket.get();
    if (!ticket) return nothing;

    const chatHistory = (ticket.chat_history ?? []).filter(
      (m) => m.text.trim() !== ""
    );

    const inputUi = this.renderInputUi(ticket);
    if (chatHistory.length === 0 && !inputUi) return nothing;

    // When the input panel is showing, the agent's prompt text duplicates
    // the last agent message in the log. Drop it to avoid the echo.
    const displayHistory = inputUi
      ? this.#dropTrailingAgentMessage(chatHistory)
      : chatHistory;

    return html`
      <div class="chat-container">
        ${displayHistory.length > 0
          ? html`
              <div class="chat-log">
                ${displayHistory.map(
                  (m) => html`
                    <div
                      class="chat-turn ${m.role === "user" ? "user" : "agent"}"
                    >
                      <div class="chat-role">${m.role}</div>
                      <div class="chat-text">${markdown(m.text)}</div>
                    </div>
                  `
                )}
              </div>
            `
          : nothing}
        ${inputUi
          ? html`<div class="response-section">${inputUi}</div>`
          : nothing}
      </div>
    `;
  }

  // ── Input UI ──

  /** Render the interactive input area, or null if not applicable. */
  private renderInputUi(ticket: TaskData): unknown {
    if (ticket.status !== "suspended" || !ticket.suspend_event) return null;

    const functionName = ticket.suspend_event.function_name as
      | string
      | undefined;
    const isUserFacing =
      ticket.assignee === "user" &&
      functionName !== "chat_await_context_update";

    if (!isUserFacing || !this.mutationClient?.boxActive.get()) return null;

    const waitForInput = ticket.suspend_event.waitForInput as
      | Record<string, unknown>
      | undefined;
    const waitForChoice = ticket.suspend_event.waitForChoice as
      | Record<string, unknown>
      | undefined;

    if (waitForInput) return this.renderReplyForm(ticket.id, waitForInput);
    if (waitForChoice) return this.renderChoiceForm(ticket.id, waitForChoice);
    return null;
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
      <div class="response-form">
        ${promptText
          ? html`<div class="agent-prompt">${markdown(promptText)}</div>`
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
      <div class="response-form">
        ${promptText
          ? html`<div class="agent-prompt">${markdown(promptText)}</div>`
          : nothing}
        <div class="choices-grid">
          ${choices.map((choice) => {
            const selected = this.selectedChoiceIds.has(choice.id);
            const label =
              this.extractPromptText(choice.content) || choice.id;
            return html`
              <div
                class="choice-card ${selected ? "selected" : ""}"
                @click=${() => this.toggleChoice(choice.id, selectionMode)}
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
            ?disabled=${this.selectedChoiceIds.size === 0 || this.responding}
            @click=${() => this.handleChoiceReply(ticketId)}
          >
            ${this.responding ? "Sending…" : "Confirm"}
          </button>
        </div>
      </div>
    `;
  }

  // ── Interaction handlers ──

  private toggleChoice(choiceId: string, mode: string) {
    const next = new Set(this.selectedChoiceIds);
    if (mode === "single") {
      if (next.has(choiceId)) {
        next.clear();
      } else {
        next.clear();
        next.add(choiceId);
      }
    } else {
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

  /**
   * Remove the last agent message from the history when it would be
   * duplicated by the prompt text in the response panel.
   */
  #dropTrailingAgentMessage(
    history: Array<{ role: string; text: string }>
  ): Array<{ role: string; text: string }> {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role !== "user") {
        return [...history.slice(0, i), ...history.slice(i + 1)];
      }
    }
    return history;
  }
}

/**
 * Whether a ticket has chat content — messages or pending user input.
 * Exported for use by parent components (tab visibility probing).
 */
export function hasChatContent(ticket: TaskData): boolean {
  const hasMessages = (ticket.chat_history ?? []).some(
    (m) => m.text.trim() !== ""
  );
  if (hasMessages) return true;

  if (ticket.status === "suspended" && ticket.suspend_event) {
    const fn = ticket.suspend_event.function_name as string | undefined;
    const isUserFacing =
      ticket.assignee === "user" && fn !== "chat_await_context_update";
    if (isUserFacing) {
      const hasInput = !!ticket.suspend_event.waitForInput;
      const hasChoice = !!ticket.suspend_event.waitForChoice;
      if (hasInput || hasChoice) return true;
    }
  }

  return false;
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-chat-panel": BeesChatPanel;
  }
}
