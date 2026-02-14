/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, html, css, nothing } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import type { Capabilities, LLMContent } from "@breadboard-ai/types";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";
import { A2ModuleFactory } from "../../../a2/runnable-module-factory.js";
import { invokeGraphEditingAgent } from "../../../a2/agent/graph-editing-main.js";
import {
  createGraphEditingState,
  type GraphEditingState,
} from "./graph-editing-state.js";

export { GraphEditingChat };

type ChatMessage = {
  role: "user" | "model" | "system";
  text: string;
};

/**
 * A chat overlay for the graph editing agent.
 *
 * Uses the real `Loop` infrastructure via `invokeGraphEditingAgent`.
 * The overlay creates its own standalone reactive state (ConsoleEntry +
 * AppScreen) and watches it via `SignalWatcher` to reactively render
 * chat messages and input requests from the agent.
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
  accessor #running = false;

  @state()
  accessor #waitingForInput = false;

  @query("#chat-input")
  accessor #inputEl: HTMLInputElement | null = null;

  /**
   * Standalone reactive state for this overlay.
   * Created fresh for each conversation session.
   */
  #editingState: GraphEditingState | null = null;

  /**
   * AbortController for the current agent loop run.
   */
  #abortController: AbortController | null = null;

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
        }}
        title="Graph Editor Agent"
      >
        ✦
      </button>`;
    }

    // Check for agent messages in the console entry's work items
    this.#syncMessagesFromState();

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
            ? html`<div class="message system">
                Ask me to build or modify the graph.
              </div>`
            : nothing}
          ${this.#messages.map(
            (msg) => html`<div class="message ${msg.role}">${msg.text}</div>`
          )}
          ${this.#running && !this.#waitingForInput
            ? html`<div class="message system">Thinking…</div>`
            : nothing}
        </div>
        <div id="chat-input-area">
          <input
            id="chat-input"
            type="text"
            placeholder="e.g. Add a generate text step"
            ?disabled=${this.#running && !this.#waitingForInput}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter") this.#onSend();
            }}
          />
          <button
            id="send-btn"
            ?disabled=${this.#running && !this.#waitingForInput}
            @click=${this.#onSend}
          >
            Send
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Syncs chat messages from the reactive console entry state.
   * Called during render to pick up new work items pushed by the Loop.
   */
  #syncMessagesFromState() {
    if (!this.#editingState) return;

    const { consoleEntry } = this.#editingState;

    // Check if the agent is waiting for input
    const current = consoleEntry.current;
    this.#waitingForInput = current?.awaitingUserInput ?? false;

    // Extract text messages from work items
    const newMessages: ChatMessage[] = [];
    for (const [, item] of consoleEntry.work) {
      // Work items with products containing LLMContent are agent messages
      for (const [, product] of item.product) {
        if (this.#isLLMContent(product)) {
          const text = this.#extractText(product);
          if (text) {
            newMessages.push({ role: "model", text });
          }
        }
      }
    }

    // Only update if there are new messages beyond what we already have
    // (user messages are tracked separately in #messages)
    if (newMessages.length > this.#lastAgentMessageCount) {
      // Rebuild messages by interleaving user messages with agent messages
      // from the work items
      this.#lastAgentMessageCount = newMessages.length;
      this.requestUpdate();
      this.#scrollToBottom();
    }
  }

  #lastAgentMessageCount = 0;

  #isLLMContent(value: unknown): value is LLMContent {
    return (
      value !== null &&
      typeof value === "object" &&
      "parts" in (value as Record<string, unknown>)
    );
  }

  #extractText(content: LLMContent): string {
    return (
      content.parts
        ?.map((p) => ("text" in p ? p.text : ""))
        .filter(Boolean)
        .join("\n") || ""
    );
  }

  async #onSend() {
    const input = this.#inputEl;
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = "";

    // If we're waiting for input for the agent, resolve it
    if (this.#waitingForInput && this.#editingState) {
      this.#messages = [...this.#messages, { role: "user", text }];
      this.#waitingForInput = false;

      // Resolve the pending input request with LLMContent format
      this.#editingState.consoleEntry.resolveInput({
        input: { parts: [{ text }] },
      });
      this.#scrollToBottom();
      return;
    }

    // First message or new conversation — start the agent loop
    this.#messages = [...this.#messages, { role: "user", text }];
    this.#running = true;
    this.#lastAgentMessageCount = 0;

    // Create fresh standalone state for this conversation
    this.#editingState = createGraphEditingState();

    // Build the objective
    const objective: LLMContent = {
      parts: [{ text }],
    };

    // Build minimal A2ModuleArgs from SCA services
    const factory = this.sca.services.sandbox as A2ModuleFactory;

    // Abort any previous run
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    const context = {
      fetchWithCreds: this.sca.services.fetchWithCreds,
      getProjectRunState: () => this.#editingState!.projectRunState,
      currentStep: { id: this.#editingState.stepId, type: "graph-editing" },
      signal: this.#abortController.signal,
    };

    const moduleArgs = factory.createModuleArgs(context);

    // Build minimal capabilities (no file system needed for graph editing)
    const caps: Capabilities = {
      query: async () => ({ entries: [] }),
      read: async () => ({ data: undefined, last: 0 }),
      write: async () => undefined as void,
    };

    try {
      const result = await invokeGraphEditingAgent(
        objective,
        caps,
        moduleArgs,
        this.sca.services.graphEditingActions
      );

      // Agent loop completed
      this.#running = false;

      if (result && "$error" in result) {
        this.#messages = [
          ...this.#messages,
          { role: "system", text: `Error: ${result.$error}` },
        ];
      } else {
        this.#messages = [...this.#messages, { role: "system", text: "Done." }];
      }
    } catch (e) {
      this.#running = false;
      this.#messages = [
        ...this.#messages,
        { role: "system", text: `Error: ${(e as Error).message}` },
      ];
    }

    this.#scrollToBottom();
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
