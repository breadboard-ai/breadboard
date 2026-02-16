/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import "../input/expanding-textarea.js";
import type { ExpandingTextarea } from "../input/expanding-textarea.js";
import { SignalWatcher } from "@lit-labs/signals";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";
import type { ChatEntry } from "../../../sca/controller/subcontrollers/editor/graph-editing-agent-controller.js";
import { markdown } from "../../directives/markdown.js";
import { icons } from "../../styles/icons.js";
import { invokeGraphEditingAgent } from "../../../a2/agent/graph-editing/main.js";

export { GraphEditingChat };

/**
 * A thin rendering shell for the graph editing agent chat panel.
 *
 * All state lives in `GraphEditingAgentController` (reactive via `@field`).
 * All lifecycle orchestration lives in `GraphEditingAgentService`.
 * This component only renders and dispatches user events.
 */
@customElement("bb-graph-editing-chat")
class GraphEditingChat extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  readonly #inputRef = createRef<ExpandingTextarea>();

  static styles = [
    icons,
    css`
      :host {
        position: fixed;
        bottom: var(--bb-grid-size-7);
        left: var(--bb-grid-size-4);
        z-index: 9999;
        font-family: "Google Sans", sans-serif;
      }

      /* ── Chat panel ── */

      #chat-container {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      #chat-panel {
        width: 380px;
        max-height: 420px;
        background: white;
        border-radius: 16px;
        box-shadow:
          0 4px 16px rgba(0, 0, 0, 0.12),
          0 1px 4px rgba(0, 0, 0, 0.08);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      #chat-header {
        padding: 12px 16px;
        color: #202124;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e8eaed;
      }

      #chat-header button {
        background: none;
        border: none;
        color: #5f6368;
        cursor: pointer;
        font-size: 18px;
        padding: 4px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #chat-header button:hover {
        background: #f1f3f4;
      }

      #chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* ── Messages ── */

      .message {
        font-size: 14px;
        line-height: 1.5;
        max-width: 85%;
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      .message.user {
        background: #d3e3fd;
        color: #1a1a1a;
        padding: 8px 14px;
        border-radius: 18px;
        align-self: flex-end;
      }

      .message.model {
        color: #202124;
        align-self: flex-start;
      }

      .message.model p {
        margin: 0 0 8px 0;
      }

      .message.model p:last-child {
        margin-bottom: 0;
      }

      .message.model ul,
      .message.model ol {
        margin: 0 0 8px 0;
        padding-left: 20px;
      }

      .message.model code {
        background: #f1f3f4;
        padding: 1px 4px;
        border-radius: 4px;
        font-size: 13px;
      }

      .message.model pre {
        background: #f1f3f4;
        padding: 8px 12px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 0 0 8px 0;
      }

      .message.model pre code {
        background: none;
        padding: 0;
      }

      .message.system {
        color: #5f6368;
        align-self: flex-start;
        font-size: 13px;
      }

      /* ── Thought groups ── */

      .thought-group {
        align-self: flex-start;
      }

      .thought-group-header {
        display: flex;
        align-items: center;
        cursor: pointer;
        color: #5f6368;
        font-size: 13px;
        user-select: none;
        list-style: none;
      }

      .thought-group-header::-webkit-details-marker {
        display: none;
      }

      .thought-group-header .chevron {
        margin-right: 4px;
        opacity: 0.6;
      }

      .thought-group-header .chevron::before {
        content: "keyboard_arrow_up";
      }

      .thought-group[open] > .thought-group-header .chevron::before {
        content: "keyboard_arrow_down";
      }

      .thought-group-header:hover {
        color: #202124;
      }

      .thought-group-body {
        padding: 4px 0 4px 24px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .thought-item {
        font-size: 12px;
        color: #5f6368;
        line-height: 1.4;
      }

      .thought-item-title {
        font-weight: 500;
        color: #3c4043;
      }

      /* ── Input area ── */

      #chat-input-bar {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
        min-width: 280px;
      }

      #chat-input-bar img {
        width: 32px;
        height: 32px;
        flex-shrink: 0;
      }

      bb-expanding-textarea {
        flex: 1;
        color: var(--light-dark-n-0);
        background: var(--light-dark-n-100);
        border: none;
        border-radius: var(--bb-grid-size-7);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
        --min-lines: 1;
        --max-lines: 4;
        font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        line-height: 1lh;
        caret-color: var(--light-dark-n-0);
        box-shadow:
          0 1px 3px rgba(0, 0, 0, 0.12),
          0 1px 2px rgba(0, 0, 0, 0.08);

        &:focus-within {
          outline: 1px solid var(--ui-custom-o-100);
        }

        > [slot~="submit"] {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          color: light-dark(var(--n-70), var(--n-40));
          font-size: 22px;
          width: 22px;
          height: 22px;
          transition: color 0.2s ease;
          cursor: default;
          pointer-events: none;

          &.active {
            color: light-dark(var(--n-0), var(--n-100)) !important;
            cursor: pointer;
            pointer-events: auto;
          }
        }

        &::part(textarea)::placeholder {
          color: #5f6368;
        }
      }

      .icon {
        font-family: "Google Symbols";
        font-size: 20px;
      }
    `,
  ];

  render() {
    const { parsedUrl } = this.sca.controller.router;
    const agent = this.sca.controller.editor.graphEditingAgent;

    // Hide entirely when not viewing a graph (e.g. home page)
    if (parsedUrl.page !== "graph") {
      return nothing;
    }

    // If the graph changed, reset the loop
    if (agent.currentFlow !== parsedUrl.flow) {
      this.sca.services.graphEditingAgentService.resetLoop(this.sca.controller);
      agent.currentFlow = parsedUrl.flow ?? null;
    }

    const inputDisabled = agent.processing;

    return html`
      <div id="chat-container">
        ${agent.open
          ? html`
              <div id="chat-panel">
                <div id="chat-header">
                  <span>Chat</span>
                  <button
                    @click=${() => {
                      agent.open = false;
                    }}
                  >
                    <span class="icon">close</span>
                  </button>
                </div>
                <div id="chat-messages">
                  ${agent.entries.map((entry) => this.#renderEntry(entry))}
                  ${agent.loopRunning && !agent.waiting
                    ? html`<div class="message system">Thinking…</div>`
                    : nothing}
                </div>
              </div>
            `
          : nothing}
        <div id="chat-input-bar">
          <img src="/images/favicon.png" alt="" />
          <bb-expanding-textarea
            ${ref(this.#inputRef)}
            .disabled=${inputDisabled}
            .placeholder=${"Edit Opal with Gemini"}
            @focus=${() => {
              if (!agent.open) {
                agent.open = true;
                agent.showGreeting();
                // Re-focus after Lit update completes
                this.updateComplete.then(() => {
                  this.#inputRef.value?.focus();
                });
              }
            }}
            @change=${this.#onSend}
            @input=${() => this.requestUpdate()}
          >
            <span
              slot="submit"
              class="icon ${this.#inputRef.value?.value ? "active" : ""}"
              >send_spark</span
            >
          </bb-expanding-textarea>
        </div>
      </div>
    `;
  }

  #renderEntry(entry: ChatEntry) {
    if (entry.kind === "message") {
      const content =
        entry.role === "model" ? markdown(entry.text) : entry.text;
      return html`<div class="message ${entry.role}">${content}</div>`;
    }

    // Thought group — native <details>/<summary> disclosure
    const thoughts = entry.thoughts;
    const latest = thoughts[thoughts.length - 1];
    const title = latest.title ?? latest.body;

    return html`
      <details class="thought-group">
        <summary class="thought-group-header">
          <span class="chevron g-icon"></span>${title}
        </summary>
        <div class="thought-group-body">
          ${thoughts.map(
            (t) => html`
              <div class="thought-item">
                ${t.title
                  ? html`<span class="thought-item-title">${t.title}:</span>
                      ${markdown(t.body)}`
                  : markdown(t.body)}
              </div>
            `
          )}
        </div>
      </details>
    `;
  }

  async #onSend() {
    const input = this.#inputRef.value;
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    const agent = this.sca.controller.editor.graphEditingAgent;
    const service = this.sca.services.graphEditingAgentService;

    agent.addMessage("user", text);
    this.#scrollToBottom();

    if (!service.resolveInput(text, this.sca.controller)) {
      // No pending resolve — this is the first message, start the loop
      agent.processing = true;
      service.startLoop(
        text,
        this.sca.controller,
        this.sca.services,
        invokeGraphEditingAgent
      );
    }
  }

  #scrollToBottom() {
    requestAnimationFrame(() => {
      const container = this.renderRoot.querySelector("#chat-messages");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }
}
