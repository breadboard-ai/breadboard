/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, html, css, nothing } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import type { LLMContent } from "@breadboard-ai/types";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";
import { A2ModuleFactory } from "../../../a2/runnable-module-factory.js";
import { invokeGraphEditingAgent } from "../../../a2/agent/graph-editing-main.js";
import type { LoopHooks } from "../../../a2/agent/types.js";

export { GraphEditingChat };

type ChatMessage = {
  role: "user" | "model" | "system";
  text: string;
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
  accessor #messages: ChatMessage[] = [];

  @state()
  accessor #waiting = false;

  @query("#chat-input")
  accessor #inputEl: HTMLInputElement | null = null;

  #abortController: AbortController | null = null;
  #loopRunning = false;
  #pendingResolve: ((text: string) => void) | null = null;

  static styles = css`
    :host {
      position: fixed;
      bottom: 16px;
      left: 16px;
      z-index: 9999;
      font-family: "Google Sans", sans-serif;
    }

    /* ── Collapsed input bar ── */

    #input-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      border-radius: 28px;
      padding: 8px 16px 8px 8px;
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.12),
        0 1px 2px rgba(0, 0, 0, 0.08);
      cursor: pointer;
      min-width: 280px;
    }

    #input-bar:hover {
      box-shadow:
        0 2px 6px rgba(0, 0, 0, 0.16),
        0 1px 3px rgba(0, 0, 0, 0.1);
    }

    #bar-icon {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
    }

    #bar-label {
      flex: 1;
      color: #5f6368;
      font-size: 14px;
      line-height: 20px;
    }

    #bar-history {
      font-family: "Google Symbols";
      font-size: 20px;
      color: #5f6368;
      flex-shrink: 0;
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

    .message.system {
      color: #5f6368;
      align-self: flex-start;
      font-size: 13px;
    }

    /* ── Input area ── */

    #chat-input-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px 8px 8px;
      background: white;
      border-radius: 28px;
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.12),
        0 1px 2px rgba(0, 0, 0, 0.08);
      min-width: 280px;
    }

    #chat-input-bar img {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
    }

    #chat-input {
      flex: 1;
      border: none;
      background: transparent;
      color: #202124;
      font-size: 14px;
      line-height: 20px;
      outline: none;
      font-family: inherit;
    }

    #chat-input::placeholder {
      color: #5f6368;
    }

    #chat-input:disabled {
      opacity: 0.5;
    }

    #send-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #1a73e8;
      font-size: 18px;
    }

    #send-btn:hover {
      background: #f1f3f4;
    }

    #send-btn:disabled {
      opacity: 0.3;
      cursor: default;
    }

    .icon {
      font-family: "Google Symbols";
      font-size: 20px;
    }
  `;

  render() {
    if (!this.#open) {
      return html`
        <div
          id="input-bar"
          @click=${() => {
            this.#open = true;
            this.#ensureLoopRunning();
          }}
        >
          <img id="bar-icon" src="/images/favicon.png" alt="" />
          <span id="bar-label">Edit Opal with Gemini</span>
          <span id="bar-history">history</span>
        </div>
      `;
    }

    const inputDisabled = this.#loopRunning && !this.#waiting;

    return html`
      <div id="chat-container">
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
            ${this.#messages.map(
              (msg) => html`<div class="message ${msg.role}">${msg.text}</div>`
            )}
            ${this.#loopRunning && !this.#waiting
              ? html`<div class="message system">Thinking…</div>`
              : nothing}
          </div>
        </div>
        <div id="chat-input-bar">
          <img src="/images/favicon.png" alt="" />
          <input
            id="chat-input"
            type="text"
            placeholder="Edit Opal with Gemini"
            ?disabled=${inputDisabled}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter") this.#onSend();
            }}
          />
          <button
            id="send-btn"
            ?disabled=${inputDisabled}
            @click=${this.#onSend}
          >
            <span class="icon">send_spark</span>
          </button>
        </div>
      </div>
    `;
  }

  #addMessage(role: ChatMessage["role"], text: string) {
    this.#messages = [...this.#messages, { role, text }];
    this.#scrollToBottom();
  }

  #waitForInput = (agentMessage: string): Promise<string> => {
    this.#addMessage("model", agentMessage);
    this.#waiting = true;
    return new Promise<string>((resolve) => {
      this.#pendingResolve = resolve;
    });
  };

  #buildHooks(): LoopHooks {
    return {
      onThought: (text) => {
        this.#addMessage("model", text);
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
    const input = this.#inputEl;
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    this.#addMessage("user", text);

    if (this.#pendingResolve) {
      const resolve = this.#pendingResolve;
      this.#pendingResolve = null;
      this.#waiting = false;
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
      this.sca.services.graphEditingActions,
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

  #scrollToBottom() {
    requestAnimationFrame(() => {
      const container = this.renderRoot.querySelector("#chat-messages");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }
}
