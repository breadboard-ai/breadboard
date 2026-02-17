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
import { floatingPanelStyles } from "../../styles/floating-panel.js";
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
    floatingPanelStyles,
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
        gap: var(--bb-grid-size-2);
      }

      #chat-panel {
        width: 380px;
        max-height: 420px;
        border-radius: var(--bb-grid-size-4);
        padding: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      #chat-header {
        padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
        color: var(--light-dark-n-10);
        font-size: 14px;
        font-weight: 500;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--light-dark-n-90);
      }

      #chat-header button {
        background: none;
        border: none;
        color: var(--light-dark-n-50);
        cursor: pointer;
        font-size: 18px;
        padding: var(--bb-grid-size);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #chat-header button:hover {
        background: var(--light-dark-n-95);
      }

      #chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: var(--bb-grid-size-4);
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-3);
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
        background: var(--light-dark-p-90);
        color: var(--light-dark-n-10);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        border-radius: 18px;
        align-self: flex-end;
      }

      .message.model {
        color: var(--light-dark-n-10);
        align-self: flex-start;
      }

      .message.model p {
        margin: 0 0 var(--bb-grid-size-2) 0;
      }

      .message.model p:last-child {
        margin-bottom: 0;
      }

      .message.model ul,
      .message.model ol {
        margin: 0 0 var(--bb-grid-size-2) 0;
        padding-left: 20px;
      }

      .message.model code {
        background: var(--light-dark-n-95);
        padding: 1px var(--bb-grid-size);
        border-radius: var(--bb-grid-size);
        font-size: 13px;
      }

      .message.model pre {
        background: var(--light-dark-n-95);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size-2);
        overflow-x: auto;
        margin: 0 0 var(--bb-grid-size-2) 0;
      }

      .message.model pre code {
        background: none;
        padding: 0;
      }

      .message.system {
        color: var(--light-dark-n-50);
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
        color: var(--light-dark-n-50);
        font-size: 13px;
        user-select: none;
        list-style: none;
      }

      .thought-group-header::-webkit-details-marker {
        display: none;
      }

      .thought-group-header .chevron {
        margin-right: var(--bb-grid-size);
        opacity: 0.6;
      }

      .thought-group-header .chevron::before {
        content: "keyboard_arrow_up";
      }

      .thought-group[open] > .thought-group-header .chevron::before {
        content: "keyboard_arrow_down";
      }

      .thought-group-header:hover {
        color: var(--light-dark-n-10);
      }

      .thought-group-body {
        padding: var(--bb-grid-size) 0 var(--bb-grid-size) var(--bb-grid-size-6);
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size);
      }

      .thought-item {
        font-size: 12px;
        color: var(--light-dark-n-50);
        line-height: 1.4;
      }

      .thought-item-title {
        font-weight: 500;
        color: var(--light-dark-n-30);
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
          color: var(--light-dark-n-50);
        }
      }

      /* ── Selection indicator ── */

      #selection-strip {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
        flex-wrap: wrap;
        font-size: 12px;
        border-top: 1px solid var(--light-dark-n-90);
      }

      #selection-strip .selection-label {
        color: var(--light-dark-n-50);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .selection-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--bb-grid-size);
        background: var(--light-dark-p-90);
        color: var(--light-dark-n-10);
        border-radius: var(--bb-grid-size-3);
        padding: 2px var(--bb-grid-size) 2px var(--bb-grid-size-2);
        font-size: 12px;
        font-weight: 500;
      }

      .selection-chip button {
        background: none;
        border: none;
        color: var(--light-dark-n-50);
        cursor: pointer;
        font-size: 14px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        width: 16px;
        height: 16px;
      }

      .selection-chip button:hover {
        color: var(--light-dark-n-10);
        background: var(--light-dark-n-90);
      }
    `,
  ];

  override updated() {
    this.#scrollToBottom();
  }

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
              <div id="chat-panel" class="bb-floating-panel">
                <div id="chat-header">
                  <span>Chat</span>
                  <button
                    @click=${() => {
                      agent.open = false;
                    }}
                  >
                    <span class="g-icon">close</span>
                  </button>
                </div>
                <div id="chat-messages">
                  ${agent.entries.map((entry) => this.#renderEntry(entry))}
                  ${agent.loopRunning && !agent.waiting
                    ? html`<div class="message system">Thinking…</div>`
                    : nothing}
                </div>
                ${this.#renderSelectionStrip()}
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
              class="g-icon ${this.#inputRef.value?.value ? "active" : ""}"
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

  #renderSelectionStrip() {
    const selection = this.sca.controller.editor.selection;
    const selectedNodes = selection.selection.nodes;
    if (selectedNodes.size === 0) return nothing;

    const editor = this.sca.controller.editor.graph.editor;
    if (!editor) return nothing;

    const inspector = editor.inspect("");
    const chips = [...selectedNodes].map((nodeId) => {
      const node = inspector.nodeById(nodeId);
      const title = node?.metadata()?.title ?? "(untitled)";
      return html`
        <span class="selection-chip">
          ${title}
          <button
            @click=${() => {
              selection.removeNode(nodeId);
              this.#inputRef.value?.focus();
            }}
            title="Deselect ${title}"
          >
            <span class="g-icon">close</span>
          </button>
        </span>
      `;
    });

    return html`
      <div id="selection-strip">
        <span class="selection-label">Selected</span>
        ${chips}
      </div>
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
