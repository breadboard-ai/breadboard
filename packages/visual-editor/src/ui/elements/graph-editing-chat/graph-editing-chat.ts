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
 * The agent loop is persistent — it starts on the first message and runs
 * for the session lifetime. Between interactions the agent parks on
 * `wait_for_user_input`, which resolves when the user sends a message.
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

  /**
   * AbortController for the agent loop.
   */
  #abortController: AbortController | null = null;

  /**
   * Whether the persistent loop is running.
   */
  #loopRunning = false;

  /**
   * Pending resolve callback — set when the agent calls wait_for_user_input.
   * Resolved when the user sends a message.
   */
  #pendingResolve: ((text: string) => void) | null = null;

  static styles = css`
    :host {
      position: fixed;
      bottom: 16px;
      left: 16px;
      z-index: 9999;
      font-family: "Google Sans", sans-serif;
    }

    #toggle-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: none;
      background: #1a73e8;
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #toggle-btn:hover {
      background: #1557b0;
    }

    #chat-panel {
      width: 380px;
      height: 480px;
      background: #1e1e1e;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    #chat-header {
      padding: 12px 16px;
      background: #2d2d2d;
      color: #e0e0e0;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #chat-header button {
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      font-size: 18px;
      padding: 0;
    }

    #chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .message {
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.4;
      max-width: 85%;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .message.user {
      background: #1a73e8;
      color: white;
      align-self: flex-end;
    }

    .message.model {
      background: #333;
      color: #e0e0e0;
      align-self: flex-start;
    }

    .message.system {
      background: #2a2a2a;
      color: #888;
      align-self: center;
      font-style: italic;
      font-size: 12px;
    }

    #chat-input-area {
      padding: 12px;
      background: #2d2d2d;
      display: flex;
      gap: 8px;
    }

    #chat-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #444;
      border-radius: 8px;
      background: #1e1e1e;
      color: #e0e0e0;
      font-size: 13px;
      outline: none;
    }

    #chat-input:focus {
      border-color: #1a73e8;
    }

    #chat-input:disabled {
      opacity: 0.5;
    }

    #send-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      background: #1a73e8;
      color: white;
      cursor: pointer;
      font-size: 13px;
    }

    #send-btn:hover {
      background: #1557b0;
    }

    #send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  render() {
    if (!this.#open) {
      return html`<button
        id="toggle-btn"
        @click=${() => {
          this.#open = true;
          this.#ensureLoopRunning();
        }}
        title="Graph Editor Agent"
      >
        ✦
      </button>`;
    }

    // Input is enabled only when the agent is waiting for user input
    // (or the loop hasn't started yet)
    const inputDisabled = this.#loopRunning && !this.#waiting;

    return html`
      <div id="chat-panel">
        <div id="chat-header">
          <span>Graph Editor Agent</span>
          <button
            @click=${() => {
              this.#open = false;
            }}
          >
            ✕
          </button>
        </div>
        <div id="chat-messages">
          ${this.#messages.length === 0
            ? html`<div class="message system">Starting…</div>`
            : nothing}
          ${this.#messages.map(
            (msg) => html`<div class="message ${msg.role}">${msg.text}</div>`
          )}
          ${this.#loopRunning && !this.#waiting
            ? html`<div class="message system">Thinking…</div>`
            : nothing}
        </div>
        <div id="chat-input-area">
          <input
            id="chat-input"
            type="text"
            placeholder="e.g. Add a generate text step"
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
            Send
          </button>
        </div>
      </div>
    `;
  }

  #addMessage(role: ChatMessage["role"], text: string) {
    this.#messages = [...this.#messages, { role, text }];
    this.#scrollToBottom();
  }

  /**
   * Called by the agent's `wait_for_user_input` function.
   * Displays the agent's message and returns a Promise that resolves
   * when the user sends a message.
   */
  #waitForInput = (agentMessage: string): Promise<string> => {
    this.#addMessage("model", agentMessage);
    this.#waiting = true;
    return new Promise<string>((resolve) => {
      this.#pendingResolve = resolve;
    });
  };

  /**
   * Build LoopHooks that push agent output directly into the chat messages.
   */
  #buildHooks(): LoopHooks {
    return {
      onThought: (text) => {
        this.#addMessage("model", text);
      },
      onFunctionCall: (part, _icon, title) => {
        const name = part.functionCall.name;
        // Don't show wait_for_user_input as a function call — it's invisible
        if (name !== "wait_for_user_input") {
          this.#addMessage("system", `Calling ${title ?? name}…`);
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

    // All user messages go through the pending resolve
    if (this.#pendingResolve) {
      const resolve = this.#pendingResolve;
      this.#pendingResolve = null;
      this.#waiting = false;
      resolve(text);
    }
  }

  /**
   * Start the persistent loop if it isn't already running.
   */
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

    // Build minimal A2ModuleArgs from SCA services
    const factory = this.sca.services.sandbox as A2ModuleFactory;

    this.#abortController?.abort();
    this.#abortController = new AbortController();

    const context = {
      fetchWithCreds: this.sca.services.fetchWithCreds,
      currentStep: { id: "graph-editing", type: "graph-editing" },
      signal: this.#abortController.signal,
    };

    const moduleArgs = factory.createModuleArgs(context);

    // Fire and forget — the loop runs until abort
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
