/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import { sharedStyles } from "./shared.styles.js";
import { styles } from "./opal-chat-overlay.styles.js";
import {
  switchThread,
  sendChat,
  sendChoices,
} from "../../sca/actions/chat/chat-actions.js";
import { markdown } from "../../directives/markdown.js";

@customElement("opal-chat-overlay")
export class OpalChatOverlay extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [sharedStyles, styles];

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    this.#scrollChatToBottom();
  }

  render() {
    const chat = this.sca.controller.chat;
    const activeThreadId = chat.activeThreadId;
    const thread = chat.threads.find((t) => t.id === activeThreadId);
    const messages = chat.threadMessages.get(activeThreadId) ?? [];
    const showRail = chat.threads.length > 1;

    return html`
      <div class="chat-overlay ${chat.isOpen ? "open" : ""}">
        <div class="chat-header">
          <span class="chat-title">${thread?.title ?? "Chat"}</span>
          <button
            class="chat-close"
            @click=${() => (chat.isOpen = false)}
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>
        <div class="chat-body">
          ${showRail ? this.#renderThreadRail() : null}
          <div class="chat-messages" id="chat-messages">
            ${this.#groupedMessages(messages).map((group) => {
              if (group.length === 1) {
                const m = group[0];
                return html`<div class="chat-msg ${m.role}">
                  ${markdown(m.text)}
                </div>`;
              }
              const [primary, ...updates] = group;
              return html`<div class="chat-msg agent">
                ${markdown(primary.text)}
                ${updates.map(
                  (u) =>
                    html`<div class="chat-status-update">
                      <span class="status-arrow">↳</span>
                      ${markdown(u.text)}
                    </div>`
                )}
              </div>`;
            })}
          </div>
        </div>
        ${chat.pendingChoices.length > 0
          ? this.#renderChoiceInput()
          : this.#renderTextInput()}
      </div>
    `;
  }

  #renderThreadRail() {
    const chat = this.sca.controller.chat;
    return html`
      <div class="thread-rail">
        ${chat.threads.map(
          (t) => html`
            <button
              class="thread-item ${t.id === chat.activeThreadId
                ? "active"
                : ""}"
              @click=${() =>
                switchThread(new CustomEvent("switch", { detail: t.id }))}
            >
              <span class="thread-item-title">${t.title}</span>
              ${t.hasUnread ? html`<span class="thread-unread"></span>` : null}
            </button>
          `
        )}
      </div>
    `;
  }

  get #isInputDisabled(): boolean {
    const chat = this.sca.controller.chat;
    const activeThreadId = chat.activeThreadId;

    const thread = chat.threads.find((t) => t.id === activeThreadId);

    // The main "opie" thread is always available for free-form chat, UNLESS it
    // is actively generating a response (running) or queued to run (available).
    if (activeThreadId === "opie") {
      if (!thread?.activeTicketId) return false;
      const opieTicket = this.sca.controller.global.tickets.find(
        (t) => t.id === thread.activeTicketId
      );
      if (!opieTicket) return false;
      return (
        opieTicket.status === "running" || opieTicket.status === "available"
      );
    }

    // For ticket-specific threads, only enable when suspended for user input.
    if (!thread?.activeTicketId) return true;
    const ticket = this.sca.controller.global.tickets.find(
      (t) => t.id === thread.activeTicketId
    );
    return !(ticket?.status === "suspended" && ticket?.assignee === "user");
  }

  #renderTextInput() {
    const chat = this.sca.controller.chat;
    const disabled = this.#isInputDisabled;

    if (disabled) {
      const thread = chat.threads.find((t) => t.id === chat.activeThreadId);
      const label =
        chat.activeThreadId === "opie"
          ? "Opie is thinking…"
          : `Working on ${thread?.title ?? "a task"}…`;
      return html`
        <div class="chat-input-area">
          <div class="chat-working-indicator">
            <div class="spinner"></div>
            <span>${label}</span>
          </div>
        </div>
      `;
    }

    return html`
      <div class="chat-input-area">
        <input
          type="text"
          placeholder="Type a message..."
          autocomplete="off"
          .value=${chat.input}
          @input=${(e: Event) =>
            (chat.input = (e.target as HTMLInputElement).value)}
          @keydown=${this.#onChatKeyDown}
        />
        <button @click=${() => this.#sendChat()}>Send</button>
      </div>
    `;
  }

  #renderChoiceInput() {
    const chat = this.sca.controller.chat;
    const isMultiple = chat.pendingSelectionMode === "multiple";
    return html`
      <div class="chat-choices-area">
        <div class="chat-chips">
          ${chat.pendingChoices.map((c) => {
            const selected = chat.selectedChoiceIds.includes(c.id);
            return html`
              <button
                class="chat-chip ${selected ? "selected" : ""}"
                @click=${() => this.#onChipClick(c.id, isMultiple)}
              >
                ${c.text}
              </button>
            `;
          })}
        </div>
        ${isMultiple
          ? html`<button
              class="chat-chip-send"
              ?disabled=${chat.selectedChoiceIds.length === 0}
              @click=${() =>
                sendChoices(
                  new CustomEvent("choices", { detail: chat.selectedChoiceIds })
                )}
            >
              Send Selection
            </button>`
          : null}
      </div>
    `;
  }

  #groupedMessages(messages: { role: string; text: string }[]) {
    const groups: { role: string; text: string }[][] = [];
    for (const m of messages) {
      if (
        m.role === "agent" &&
        groups.length > 0 &&
        groups[groups.length - 1][0].role === "agent"
      ) {
        groups[groups.length - 1].push(m);
      } else {
        groups.push([m]);
      }
    }
    return groups;
  }

  #onChatKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") this.#sendChat();
  }

  #sendChat() {
    const text = this.sca.controller.chat.input.trim();
    if (!text) return;
    this.sca.controller.chat.input = "";
    sendChat(new CustomEvent("chat", { detail: text }));
  }

  #onChipClick(choiceId: string, isMultiple: boolean) {
    const chat = this.sca.controller.chat;
    if (isMultiple) {
      if (chat.selectedChoiceIds.includes(choiceId)) {
        chat.selectedChoiceIds = chat.selectedChoiceIds.filter(
          (id) => id !== choiceId
        );
      } else {
        chat.selectedChoiceIds = [...chat.selectedChoiceIds, choiceId];
      }
    } else {
      sendChoices(new CustomEvent("choices", { detail: [choiceId] }));
    }
  }

  #scrollChatToBottom() {
    this.updateComplete.then(() => {
      const el = this.renderRoot.querySelector("#chat-messages");
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
