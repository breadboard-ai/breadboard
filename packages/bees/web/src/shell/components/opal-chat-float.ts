/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, query } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import { sharedStyles } from "./shared.styles.js";
import { markdown } from "../../directives/markdown.js";

import {
  sendChat,
  sendChoices,
} from "../../sca/actions/chat/chat-actions.js";

const styles = css`
  :host {
    position: absolute;
    bottom: var(--cg-sp-6, 24px);
    right: var(--cg-sp-6, 24px);
    z-index: 300;
    font-family: var(--cg-font-sans, "Inter", system-ui, sans-serif);
  }

  /* ── Minimized dot ── */

  .chat-dot {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--cg-color-primary, #3b5fc0);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.12),
      0 1px 4px rgba(0, 0, 0, 0.08);
    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
    border: none;
    color: #fff;
    font-size: 20px;
  }

  .chat-dot:hover {
    transform: scale(1.08);
    box-shadow:
      0 6px 20px rgba(0, 0, 0, 0.16),
      0 2px 6px rgba(0, 0, 0, 0.1);
  }

  .chat-dot:active {
    transform: scale(0.96);
  }

  .chat-dot.unread {
    animation: glow 2s ease-in-out infinite;
  }

  @keyframes glow {
    0%, 100% {
      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.12),
        0 0 0 0 rgba(59, 95, 192, 0);
    }
    50% {
      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.12),
        0 0 0 10px rgba(59, 95, 192, 0.25);
    }
  }

  /* ── Expanded panel ── */

  .chat-panel {
    width: 380px;
    max-height: 520px;
    display: flex;
    flex-direction: column;
    background: var(--cg-color-surface-bright, #ffffff);
    border-radius: var(--cg-radius-lg, 16px);
    border: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    animation: slideUp 0.25s cubic-bezier(0.2, 0, 0, 1) forwards;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* ── Header ── */

  .chat-header {
    display: flex;
    align-items: center;
    gap: var(--cg-sp-3, 12px);
    padding: var(--cg-sp-3, 12px) var(--cg-sp-4, 16px);
    background: var(--cg-color-surface-dim, #f5f3f0);
    border-bottom: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    flex-shrink: 0;
  }

  .chat-header-title {
    flex: 1;
    font-size: var(--cg-text-body-md-size, 14px);
    font-weight: 600;
    color: var(--cg-color-on-surface, #1c1b1f);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-header-status {
    font-size: var(--cg-text-label-sm-size, 11px);
    font-weight: 500;
    padding: 2px 8px;
    border-radius: var(--cg-radius-full, 999px);
    text-transform: capitalize;
  }

  .chat-header-status.running {
    background: #ff980022;
    color: #e65100;
  }

  .chat-header-status.suspended {
    background: var(--cg-color-primary-container, #dbe1f9);
    color: var(--cg-color-primary, #3b5fc0);
  }

  .chat-header-status.completed {
    background: #4caf5022;
    color: #2e7d32;
  }

  .minimize-btn {
    background: transparent;
    border: none;
    width: 28px;
    height: 28px;
    border-radius: var(--cg-radius-sm, 4px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cg-color-on-surface-muted, #79757f);
    transition: all 0.15s ease;
    font-size: 16px;
  }

  .minimize-btn:hover {
    background: var(--cg-color-surface-container-high, #eae7e3);
    color: var(--cg-color-on-surface, #1c1b1f);
  }

  /* ── Messages ── */

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--cg-sp-4, 16px);
    display: flex;
    flex-direction: column;
    gap: var(--cg-sp-3, 12px);
    min-height: 120px;
  }

  .msg {
    max-width: 85%;
    padding: var(--cg-sp-2, 8px) var(--cg-sp-3, 12px);
    border-radius: var(--cg-radius-md, 12px);
    font-size: var(--cg-text-body-md-size, 14px);
    line-height: 1.5;
    word-wrap: break-word;
  }

  .msg.agent {
    align-self: flex-start;
    background: var(--cg-color-surface-container-low, #f8f6f3);
    color: var(--cg-color-on-surface, #1c1b1f);
    border: 1px solid var(--cg-color-outline-variant, #e0ddd9);
  }

  .msg.user {
    align-self: flex-end;
    background: var(--cg-color-primary, #3b5fc0);
    color: #fff;
  }

  .msg.thought {
    align-self: flex-start;
    font-size: var(--cg-text-body-sm-size, 12px);
    color: var(--cg-color-on-surface-muted, #79757f);
    background: transparent;
    padding: var(--cg-sp-1, 4px) var(--cg-sp-3, 12px);
    font-style: italic;
  }

  .msg.tool {
    align-self: flex-start;
    font-size: var(--cg-text-body-sm-size, 12px);
    color: var(--cg-color-on-surface-muted, #79757f);
    background: transparent;
    padding: var(--cg-sp-1, 4px) var(--cg-sp-3, 12px);
    font-family: var(--cg-font-mono, monospace);
  }

  .msg.error {
    align-self: flex-start;
    background: var(--cg-color-error-container, #ffdad6);
    color: var(--cg-color-error, #ba1a1a);
    border: 1px solid rgba(186, 26, 26, 0.2);
  }

  .msg :is(p, ul, ol) {
    margin: 0;
  }

  .empty-chat {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cg-color-on-surface-muted, #79757f);
    font-size: var(--cg-text-body-sm-size, 12px);
    opacity: 0.7;
  }

  /* ── Choices ── */

  .choices-container {
    padding: var(--cg-sp-3, 12px) var(--cg-sp-4, 16px);
    display: flex;
    flex-wrap: wrap;
    gap: var(--cg-sp-2, 8px);
    border-top: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    background: var(--cg-color-surface-container-low, #f8f6f3);
  }

  .choice-chip {
    background: var(--cg-color-surface, #ffffff);
    color: var(--cg-color-on-surface, #1c1b1f);
    border: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    padding: var(--cg-sp-2, 8px) var(--cg-sp-3, 12px);
    border-radius: var(--cg-radius-full, 999px);
    font-size: var(--cg-text-label-md-size, 14px);
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .choice-chip:hover {
    border-color: var(--cg-color-primary, #3b5fc0);
    background: var(--cg-color-primary-container, #dbe1f9);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }

  .choice-chip:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  /* ── Input ── */

  .chat-input-bar {
    display: flex;
    align-items: center;
    gap: var(--cg-sp-2, 8px);
    padding: var(--cg-sp-3, 12px) var(--cg-sp-4, 16px);
    border-top: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    background: var(--cg-color-surface, #fdfcfa);
    flex-shrink: 0;
  }

  .chat-input-bar input {
    flex: 1;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: var(--cg-text-body-md-size, 14px);
    color: var(--cg-color-on-surface, #212121);
    outline: none;
    padding: var(--cg-sp-1, 4px) 0;
  }

  .chat-input-bar input::placeholder {
    color: var(--cg-color-on-surface-muted, #9e9e9e);
  }

  .send-btn {
    background: var(--cg-color-primary, #3b5fc0);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    transition: transform 0.1s ease;
    flex-shrink: 0;
  }

  .send-btn:hover {
    transform: scale(1.05);
  }

  .send-btn:active {
    transform: scale(0.95);
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: default;
    transform: none;
  }

  .disabled-label {
    flex: 1;
    font-size: var(--cg-text-body-sm-size, 12px);
    color: var(--cg-color-on-surface-muted, #9e9e9e);
    text-align: center;
  }
`;

@customElement("opal-chat-float")
export class OpalChatFloat extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @query(".chat-messages")
  accessor messagesEl!: HTMLElement;

  /** Track message count to avoid scroll reset on re-render. */
  #lastMessageCount = 0;
  #lastThreadId: string | null = null;

  static styles = [sharedStyles, styles];

  get #activeThread() {
    const chat = this.sca.controller.chat;
    if (!chat.activeThreadId) return null;
    return chat.threads.find((t) => t.id === chat.activeThreadId) ?? null;
  }

  get #activeTicket() {
    const thread = this.#activeThread;
    if (!thread) return null;
    return (
      this.sca.controller.global.tickets.find(
        (t) => t.id === thread.activeTicketId
      ) ?? null
    );
  }

  get #isInputEnabled(): boolean {
    const ticket = this.#activeTicket;
    if (!ticket) return false;
    return ticket.status === "suspended" && ticket.assignee === "user";
  }

  updated() {
    // Only auto-scroll when new messages arrive, not on every re-render.
    const chat = this.sca?.controller?.chat;
    if (!chat?.activeThreadId || !this.messagesEl) return;

    // Reset count when switching threads.
    if (chat.activeThreadId !== this.#lastThreadId) {
      this.#lastThreadId = chat.activeThreadId;
      this.#lastMessageCount = 0;
    }

    const messages = chat.threadMessages.get(chat.activeThreadId) ?? [];
    const count = messages.length;
    if (count > this.#lastMessageCount) {
      this.#lastMessageCount = count;
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  render() {
    const chat = this.sca.controller.chat;

    // No active thread — don't render the float.
    if (!chat.activeThreadId) return nothing;

    if (chat.isMinimized) {
      return html`
        <button
          class="chat-dot ${chat.hasUnreadFloat ? "unread" : ""}"
          @click=${this.#expand}
          aria-label="Open chat"
          id="chat-float-dot"
        >
          💬
        </button>
      `;
    }

    return this.#renderExpanded();
  }

  #renderExpanded() {
    const chat = this.sca.controller.chat;
    const threadId = chat.activeThreadId!;
    const messages = chat.threadMessages.get(threadId) ?? [];
    const thread = this.#activeThread;
    const ticket = this.#activeTicket;
    const enabled = this.#isInputEnabled;
    const pendingChoices = chat.pendingChoices;

    const pulseTasks = this.sca.controller.global.pulseTasks;
    const isRunning = ticket
      ? pulseTasks.some((pt) => pt.id === ticket.id)
      : false;

    const title =
      thread?.title ??
      ticket?.title ??
      ticket?.playbook_id?.replace(/-/g, " ") ??
      "Chat";

    const statusText = isRunning
      ? "running"
      : ticket?.status === "suspended" && ticket?.assignee === "user"
        ? "suspended"
        : ticket?.status === "completed"
          ? "completed"
          : null;

    return html`
      <div class="chat-panel" id="chat-float-panel">
        <div class="chat-header">
          <span class="chat-header-title">${title}</span>
          ${statusText
            ? html`<span class="chat-header-status ${statusText}"
                >${statusText === "suspended"
                  ? "Waiting for you"
                  : statusText}</span
              >`
            : nothing}
          <button
            class="minimize-btn"
            @click=${this.#minimize}
            aria-label="Minimize chat"
          >
            ▾
          </button>
        </div>
        <div class="chat-messages">
          ${messages.length === 0
            ? html`<div class="empty-chat">No messages yet</div>`
            : messages
                .filter((m) => m.text.trim() !== "")
                .map(
                  (m) =>
                    html`<div class="msg ${m.role}">
                      ${m.role === "agent" ? markdown(m.text) : m.text}
                    </div>`
                )}
        </div>
        ${pendingChoices.length > 0 && enabled
          ? html`
              <div class="choices-container">
                ${pendingChoices.map(
                  (choice) => html`
                    <button
                      class="choice-chip"
                      @click=${() => this.#sendChoice(choice.id)}
                    >
                      ${choice.text}
                    </button>
                  `
                )}
              </div>
            `
          : nothing}
        <div class="chat-input-bar">
          ${enabled
            ? html`
                <input
                  type="text"
                  placeholder="Type a message..."
                  autocomplete="off"
                  .value=${chat.input}
                  @input=${(e: Event) =>
                    (chat.input = (e.target as HTMLInputElement).value)}
                  @keydown=${this.#onKeyDown}
                />
                <button class="send-btn" @click=${this.#sendChat}>↑</button>
              `
            : html`<span class="disabled-label">Working...</span>`}
        </div>
      </div>
    `;
  }

  #expand() {
    this.sca.controller.chat.isMinimized = false;
    this.sca.controller.chat.hasUnreadFloat = false;
  }

  #minimize() {
    this.sca.controller.chat.isMinimized = true;
  }

  #onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") this.#sendChat();
  }

  #sendChat() {
    const text = this.sca.controller.chat.input.trim();
    if (!text) return;
    this.sca.controller.chat.input = "";
    sendChat(new CustomEvent("chat", { detail: text }));
  }

  #sendChoice(choiceId: string) {
    sendChoices(new CustomEvent("choices", { detail: [choiceId] }));
  }
}
