/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import "../input/expanding-textarea.js";
import type { ExpandingTextarea } from "../input/expanding-textarea.js";
import { SignalWatcher } from "@lit-labs/signals";
import type { LLMContent } from "@breadboard-ai/types";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";
import { A2ModuleFactory } from "../../../a2/runnable-module-factory.js";
import { invokeGraphEditingAgent } from "../../../a2/agent/graph-editing/main.js";
import type { LoopHooks } from "../../../a2/agent/types.js";
import { parseThought } from "../../../a2/agent/thought-parser.js";
import { markdown } from "../../directives/markdown.js";

export { GraphEditingChat };

/**
 * A single chat entry. Can be:
 * - A user or model text message
 * - A system message (function call label)
 * - A thought group (collapsible, shows latest title)
 */
type ChatEntry =
  | { kind: "message"; role: "user" | "model" | "system"; text: string }
  | {
      kind: "thought-group";
      thoughts: { title: string | null; body: string }[];
    };

/**
 * A chat overlay for the graph editing agent.
 *
 * The agent loop is persistent — it starts when the user opens the panel
 * and runs for the session lifetime. Between interactions the agent parks
 * on `wait_for_user_input`, which resolves when the user sends a message.
 */
@customElement("bb-graph-editing-chat")
class GraphEditingChat extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @state()
  accessor #open = false;

  @state()
  accessor #entries: ChatEntry[] = [];

  @state()
  accessor #waiting = false;

  @state()
  accessor #expandedGroups: Set<number> = new Set();

  readonly #inputRef = createRef<ExpandingTextarea>();

  #abortController: AbortController | null = null;
  #loopRunning = false;
  #processing = false;
  #pendingResolve: ((text: string) => void) | null = null;

  /**
   * The flow ID that the current loop was started for.
   * Used to detect graph changes and restart the loop.
   */
  #currentFlow: string | undefined = undefined;

  static styles = css`
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
      gap: 4px;
      cursor: pointer;
      color: #5f6368;
      font-size: 13px;
      user-select: none;
    }

    .thought-group-header:hover {
      color: #202124;
    }

    .thought-group-header .icon {
      font-size: 18px;
      transition: transform 0.15s ease;
    }

    .thought-group-header .icon.expanded {
      transform: rotate(180deg);
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
  `;

  render() {
    const { parsedUrl } = this.sca.controller.router;

    // Hide entirely when not viewing a graph (e.g. home page)
    if (parsedUrl.page !== "graph") {
      return nothing;
    }

    // If the graph changed, reset the loop
    if (this.#currentFlow !== parsedUrl.flow) {
      this.#resetLoop();
      this.#currentFlow = parsedUrl.flow;
    }

    const inputDisabled = this.#processing;

    return html`
      <div id="chat-container">
        ${this.#open
          ? html`
              <div id="chat-panel">
                <div id="chat-header">
                  <span>Chat</span>
                  <button
                    @click=${() => {
                      this.#open = false;
                    }}
                  >
                    <span class="icon">close</span>
                  </button>
                </div>
                <div id="chat-messages">
                  ${this.#entries.map((entry, idx) =>
                    this.#renderEntry(entry, idx)
                  )}
                  ${this.#loopRunning && !this.#waiting
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
              if (!this.#open) {
                this.#open = true;
                this.#ensureLoopRunning();
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

  #renderEntry(entry: ChatEntry, index: number) {
    if (entry.kind === "message") {
      const content =
        entry.role === "model" ? markdown(entry.text) : entry.text;
      return html`<div class="message ${entry.role}">${content}</div>`;
    }

    // Thought group — show latest title with twistie
    const thoughts = entry.thoughts;
    const latest = thoughts[thoughts.length - 1];
    const title = latest.title ?? latest.body;
    const isExpanded = this.#expandedGroups.has(index);

    return html`
      <div class="thought-group">
        <div
          class="thought-group-header"
          @click=${() => this.#toggleGroup(index)}
        >
          <span class="icon ${isExpanded ? "expanded" : ""}">
            arrow_drop_down
          </span>
          <span>${title}</span>
        </div>
        ${isExpanded
          ? html`
              <div class="thought-group-body">
                ${thoughts.map(
                  (t) => html`
                    <div class="thought-item">
                      ${t.title
                        ? html`<span class="thought-item-title"
                              >${t.title}:</span
                            >
                            ${markdown(t.body)}`
                        : markdown(t.body)}
                    </div>
                  `
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  #toggleGroup(index: number) {
    const next = new Set(this.#expandedGroups);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this.#expandedGroups = next;
  }

  /**
   * Get or create the current thought group at the end of entries.
   * Returns the group if the last entry is a thought-group, or creates one.
   */
  #currentThoughtGroup(): ChatEntry & { kind: "thought-group" } {
    const last = this.#entries[this.#entries.length - 1];
    if (last && last.kind === "thought-group") {
      return last;
    }
    const group: ChatEntry = { kind: "thought-group", thoughts: [] };
    this.#entries = [...this.#entries, group];
    return group as ChatEntry & { kind: "thought-group" };
  }

  #addMessage(role: "user" | "model" | "system", text: string) {
    this.#entries = [...this.#entries, { kind: "message", role, text }];
    this.#scrollToBottom();
  }

  #addThought(text: string) {
    const parsed = parseThought(text);
    const group = this.#currentThoughtGroup();
    group.thoughts.push(parsed);
    // Trigger reactive update
    this.#entries = [...this.#entries];
    this.#scrollToBottom();
  }

  #waitForInput = (agentMessage: string): Promise<string> => {
    this.#addMessage("model", agentMessage);
    this.#waiting = true;
    this.#processing = false;
    return new Promise<string>((resolve) => {
      this.#pendingResolve = resolve;
    });
  };

  #buildHooks(): LoopHooks {
    return {
      onThought: (text) => {
        this.#addThought(text);
      },
      onFunctionCall: (part, _icon, title) => {
        const name = part.functionCall.name;
        if (name !== "wait_for_user_input") {
          this.#addMessage("system", `${title ?? name}…`);
        }
        return { callId: crypto.randomUUID(), reporter: null };
      },
    };
  }

  async #onSend() {
    const input = this.#inputRef.value;
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    this.#addMessage("user", text);

    if (this.#pendingResolve) {
      const resolve = this.#pendingResolve;
      this.#pendingResolve = null;
      this.#waiting = false;
      this.#processing = true;
      resolve(text);
    }
  }

  #ensureLoopRunning() {
    if (this.#loopRunning) return;
    this.#loopRunning = true;

    const objective: LLMContent = {
      parts: [
        {
          text: "You are a graph editing assistant. Greet the user briefly and call wait_for_user_input to receive their first instruction.",
        },
      ],
    };

    const factory = this.sca.services.sandbox as A2ModuleFactory;

    this.#abortController?.abort();
    this.#abortController = new AbortController();

    const context = {
      fetchWithCreds: this.sca.services.fetchWithCreds,
      currentStep: { id: "graph-editing", type: "graph-editing" },
      signal: this.#abortController.signal,
    };

    const moduleArgs = factory.createModuleArgs(context);

    invokeGraphEditingAgent(
      objective,
      moduleArgs,
      this.#waitForInput,
      this.#buildHooks()
    )
      .then((result) => {
        this.#loopRunning = false;
        if (result && "$error" in result) {
          this.#addMessage("system", `Error: ${result.$error}`);
        }
      })
      .catch((e) => {
        this.#loopRunning = false;
        this.#addMessage("system", `Error: ${(e as Error).message}`);
      });
  }

  /**
   * Kill the current loop and clear all state.
   */
  #resetLoop() {
    this.#abortController?.abort();
    this.#abortController = null;
    this.#loopRunning = false;
    this.#pendingResolve = null;
    this.#waiting = false;
    this.#open = false;
    this.#entries = [];
    this.#expandedGroups = new Set();
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
