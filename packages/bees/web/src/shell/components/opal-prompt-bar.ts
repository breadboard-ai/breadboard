/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, query } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import { sharedStyles } from "./shared.styles.js";

import {
  sendChat,
  switchThread,
  sendChoices,
} from "../../sca/actions/chat/chat-actions.js";

const styles = css`
  :host {
    display: block;
    padding: var(--cg-sp-6, 24px) var(--cg-sp-8, 32px);
    background: var(--cg-color-surface, #fdfcfa);
    border-top: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    z-index: 100;
  }

  .prompt-container {
    max-width: 800px;
    margin: 0 auto;
    position: relative;
    display: flex;
    align-items: center;
    background: var(--cg-color-surface-container-low, #f8f6f3);
    border-radius: var(--cg-radius-xl, 24px);
    padding: var(--cg-sp-3, 12px) var(--cg-sp-4, 16px);
    border: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  }

  .prompt-container:focus-within {
    background: var(--cg-color-surface-bright, #ffffff);
    border-color: var(--cg-color-primary, #3b5fc0);
    box-shadow:
      var(--cg-elevation-2, 0 4px 12px rgba(0, 0, 0, 0.06)),
      0 0 0 3px var(--cg-color-primary-container, rgba(59, 95, 192, 0.1));
  }

  .scope-pill {
    display: flex;
    align-items: center;
    background: var(--cg-color-primary-container, #e3f2fd);
    color: var(--cg-color-primary, #1976d2);
    padding: 4px 12px;
    border-radius: var(--cg-radius-full, 999px);
    font-size: var(--cg-text-label-sm-size, 12px);
    font-weight: 600;
    margin-right: var(--cg-sp-2);
    white-space: nowrap;
  }

  .scope-pill button {
    background: transparent;
    border: none;
    color: inherit;
    margin-left: 6px;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    opacity: 0.6;
    padding: 0;
  }

  .scope-pill button:hover {
    opacity: 1;
  }

  input {
    flex: 1;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: var(--cg-text-body-lg-size, 16px);
    color: var(--cg-color-on-surface, #212121);
    outline: none;
    padding: var(--cg-sp-2) 0;
    border: none;
  }

  input::placeholder {
    color: var(--cg-color-on-surface-muted, #9e9e9e);
  }

  button.send-btn {
    background: var(--cg-color-primary, #2196f3);
    color: #fff;
    border: none;
    border-radius: var(--cg-radius-full, 999px);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.1s ease;
    margin-left: var(--cg-sp-2);
  }

  button.send-btn:hover {
    transform: scale(1.05);
  }

  button.send-btn:active {
    transform: scale(0.95);
  }

  .disabled-overlay {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.7);
    border-radius: var(--cg-radius-full, 999px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: var(--cg-color-on-surface-muted, #757575);
    z-index: 10;
  }

  .agent-prompt-bubble {
    background: var(--cg-color-surface-container-high, #e6e2df);
    color: var(--cg-color-on-surface, #1c1b1f);
    padding: var(--cg-sp-4) var(--cg-sp-6);
    max-width: 800px;
    margin: 0 auto var(--cg-sp-4) auto;
    font-size: var(--cg-text-body-lg-size, 16px);
    line-height: var(--cg-text-body-lg-line-height, 24px);
    position: relative;
    z-index: 101;
    border-radius: var(--cg-radius-lg, 16px);
    border: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    animation: fadeUp 0.4s cubic-bezier(0.2, 0, 0, 1) forwards;
  }

  .choices-container {
    display: flex;
    flex-wrap: wrap;
    gap: var(--cg-sp-2);
    margin-top: var(--cg-sp-4);
  }

  .choice-chip {
    background: var(--cg-color-surface, #ffffff);
    color: var(--cg-color-on-surface, #1c1b1f);
    border: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    padding: var(--cg-sp-2) var(--cg-sp-4);
    border-radius: var(--cg-radius-full, 999px);
    font-size: var(--cg-text-label-md-size, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .choice-chip:hover {
    background: var(--cg-color-surface-bright, #ffffff);
    border-color: var(--cg-color-outline, #7a767e);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }

  .choice-chip:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    background: var(--cg-color-surface-container, #f0eeeb);
  }

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

@customElement("opal-prompt-bar")
export class OpalPromptBar extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @query("input")
  accessor inputEl!: HTMLInputElement;

  static styles = [sharedStyles, styles];

  get #isInputDisabled(): boolean {
    const chat = this.sca.controller.chat;
    const activeThreadId = chat.activeThreadId;
    const thread = chat.threads.find((t) => t.id === activeThreadId);

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

    if (!thread?.activeTicketId) return true;
    const ticket = this.sca.controller.global.tickets.find(
      (t) => t.id === thread.activeTicketId
    );
    return !(ticket?.status === "suspended" && ticket?.assignee === "user");
  }

  render() {
    const chat = this.sca.controller.chat;
    const activeThreadId = chat.activeThreadId;
    const disabled = this.#isInputDisabled;
    const isScoped = activeThreadId !== "opie";
    const thread = chat.threads.find((t) => t.id === activeThreadId);

    // Grab latest agent question and pendings choices
    const threadMessages = chat.threadMessages.get(activeThreadId) ?? [];
    const latestAgentMsg = threadMessages.findLast((m) => m.role === "agent");
    const pendingChoices = chat.pendingChoices;

    // We only show the bubble if it has choices to present. The text itself is handled
    // heavily by the timeline component in scoped journey views.
    const showPromptText =
      latestAgentMsg && !disabled && pendingChoices.length > 0;
    const showChoices = pendingChoices.length > 0 && !disabled;

    return html`
      ${showPromptText || showChoices
        ? html`
            <div class="agent-prompt-bubble">
              ${showPromptText
                ? html`<div class="prompt-text">${latestAgentMsg.text}</div>`
                : null}
              ${showChoices
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
                : null}
            </div>
          `
        : null}
      <div class="prompt-container">
        ${disabled
          ? html` <div class="disabled-overlay">Working...</div> `
          : null}
        ${isScoped && thread
          ? html`
              <div class="scope-pill">
                ${thread.title}
                <button @click=${this.#clearScope} aria-label="Clear scope">
                  ✕
                </button>
              </div>
            `
          : null}

        <input
          type="text"
          placeholder="What do you want to explore?"
          autocomplete="off"
          .value=${chat.input}
          ?disabled=${disabled}
          @input=${(e: Event) =>
            (chat.input = (e.target as HTMLInputElement).value)}
          @keydown=${this.#onKeyDown}
        />
        <button class="send-btn" @click=${this.#sendChat} ?disabled=${disabled}>
          ↑
        </button>
      </div>
    `;
  }

  #clearScope() {
    switchThread(new CustomEvent("switch", { detail: "opie" }));
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
