/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `<opal-shell>` — the Opal 2.0 magazine view.
 *
 * A Lit + SignalWatcher custom element that provides:
 * - A persistent chat overlay connected to the Opie agent
 * - A main stage iframe for digest / mini-app rendering
 * - An unobtrusive status toast for background activity
 */

import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";

import { BeesAPI } from "../data/api.js";
import { BeesConnection } from "../data/connection.js";
import { BeesState } from "../data/state.js";
import type { TicketData } from "../data/types.js";
import { extractPrompt } from "../utils.js";
import { markdown } from "../directives/markdown.js";
import { MessageBridge } from "../host/message-bridge.js";
import { styles } from "./shell.styles.js";

export { OpalShell };

interface ChatMessage {
  text: string;
  role: "agent" | "user" | "thought" | "tool";
}

const appState = new BeesState();

@customElement("opal-shell")
class OpalShell extends SignalWatcher(LitElement) {
  @state() private chatOpen = false;
  @state() private chatInput = "";
  @state() private chatMessages: ChatMessage[] = [];
  @state() private statusText = "";
  @state() private statusVisible = false;
  @state() private currentView: string | null = null;

  private connection = new BeesConnection(appState);
  private api = new BeesAPI();
  private eventSource: EventSource | null = null;
  private bridge: MessageBridge | null = null;
  private previousOpieStatus: string | null = null;
  private stateWatchInterval: ReturnType<typeof setInterval> | null = null;
  private opieBootAttempted = false;

  static styles = [styles];

  connectedCallback() {
    super.connectedCallback();
    this.connection.connect();
    this.#connectChatSSE();
    this.stateWatchInterval = setInterval(() => this.#watchState(), 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.connection.close();
    this.eventSource?.close();
    this.bridge?.dispose();
    if (this.stateWatchInterval) clearInterval(this.stateWatchInterval);
  }

  render() {
    return html`
      ${this.#renderHeader()} ${this.#renderStage()} ${this.#renderChatFab()}
      ${this.#renderChatOverlay()}
    `;
  }

  // ── Render sections ──────────────────────────────────────────────

  #renderHeader() {
    return html`
      <header>
        <div class="brand">
          <span class="brand-icon">◇</span>
          Opal
        </div>
        <div class="actions">
          <a href="/devtools.html">DevTools</a>
        </div>
      </header>
    `;
  }

  #renderStage() {
    return html`
      <div class="stage" id="stage">
        ${this.currentView === null
          ? html`
              <div class="empty">
                <span class="empty-icon">✦</span>
                <h2>Good morning</h2>
                <p>
                  Opie is setting things up. Chat with me using the button
                  below, or wait for the digest to appear.
                </p>
              </div>
            `
          : nothing}
        <div class="status-toast ${this.statusVisible ? "visible" : ""}">
          <div class="spinner"></div>
          <span>${this.statusText}</span>
        </div>
      </div>
    `;
  }

  #renderChatFab() {
    return html`
      <button
        class="chat-fab ${this.chatOpen ? "hidden" : ""}"
        @click=${this.#toggleChat}
        aria-label="Chat with Opie"
      >
        💬
      </button>
    `;
  }

  #renderChatOverlay() {
    return html`
      <div class="chat-overlay ${this.chatOpen ? "open" : ""}">
        <div class="chat-header">
          <span class="chat-title">Opie</span>
          <button
            class="chat-close"
            @click=${this.#toggleChat}
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>
        <div class="chat-messages" id="chat-messages">
          ${this.chatMessages.map(
            (m) =>
              html`<div class="chat-msg ${m.role}">
                ${m.role === "agent" ? markdown(m.text) : m.text}
              </div>`
          )}
        </div>
        <div class="chat-input-area">
          <input
            type="text"
            placeholder="Ask Opie anything..."
            autocomplete="off"
            .value=${this.chatInput}
            @input=${(e: Event) =>
              (this.chatInput = (e.target as HTMLInputElement).value)}
            @keydown=${this.#onChatKeyDown}
          />
          <button @click=${this.#sendChat}>Send</button>
        </div>
      </div>
    `;
  }

  // ── Chat logic ───────────────────────────────────────────────────

  #toggleChat() {
    this.chatOpen = !this.chatOpen;
    if (this.chatOpen) {
      this.updateComplete.then(() => {
        this.renderRoot
          .querySelector<HTMLInputElement>(".chat-input-area input")
          ?.focus();
      });
    }
  }

  #onChatKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") this.#sendChat();
  }

  async #sendChat() {
    const text = this.chatInput.trim();
    if (!text) return;

    const opie = this.#findOpieTicket();
    if (!opie) return;

    this.chatMessages = [...this.chatMessages, { text, role: "user" }];
    this.chatInput = "";
    this.#scrollChatToBottom();

    await this.api.respond(opie.id, text);
  }

  #addChatMessage(text: string, role: ChatMessage["role"]) {
    this.chatMessages = [...this.chatMessages, { text, role }];
    this.#scrollChatToBottom();
  }

  #scrollChatToBottom() {
    this.updateComplete.then(() => {
      const el = this.renderRoot.querySelector("#chat-messages");
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  // ── SSE chat hook ────────────────────────────────────────────────

  /**
   * Open a parallel EventSource to intercept session_event for the Opie
   * ticket and render them as chat messages. The standard BeesConnection
   * handles state updates separately.
   */
  #connectChatSSE() {
    this.eventSource = new EventSource("/events");

    this.eventSource.addEventListener("session_event", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const ticketId = data.ticket_id;
      const event = data.event;

      const opie = this.#findOpieTicket();
      if (!opie || ticketId !== opie.id) return;

      if ("thought" in event) {
        const thought = event.thought as Record<string, unknown>;
        const text = thought.text as string;
        if (text) this.#addChatMessage(`💭 ${text}`, "thought");
      }

      if ("functionCall" in event) {
        const fc = event.functionCall as Record<string, unknown>;
        const name = fc.name as string;
        if (name) this.#addChatMessage(`🔧 ${name}`, "tool");
      }
    });

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      setTimeout(() => this.#connectChatSSE(), 2000);
    };
  }

  // ── State watching ───────────────────────────────────────────────

  #findOpieTicket(): TicketData | undefined {
    return appState.tickets.get().find((t) => t.tags?.includes("opie"));
  }

  /**
   * Watch the reactive state for Opie-relevant transitions.
   * Runs on a 1s interval (will migrate to Signal.effect / SCA triggers
   * once the full SCA architecture is in place).
   */
  #watchState() {
    const tickets = appState.tickets.get();
    const opie = tickets.find((t) => t.tags?.includes("opie"));

    // Auto-boot Opie if no ticket is found — belt-and-suspenders with
    // the server-side auto-boot in lifespan. Only attempt once.
    if (!opie && !this.opieBootAttempted && tickets.length > 0) {
      // tickets.length > 0 means we've received the initial state,
      // so the absence of an opie ticket is real, not just latency.
      this.opieBootAttempted = true;
      console.log("[opal-shell] No Opie ticket found, auto-booting...");
      this.api.runPlaybook("opie");
      return;
    }

    if (!opie) return;

    // Detect state transitions.
    const currentStatus = `${opie.status}:${opie.assignee ?? ""}`;
    if (currentStatus !== this.previousOpieStatus) {
      this.previousOpieStatus = currentStatus;

      // When Opie suspends waiting for user input, show the prompt.
      if (opie.status === "suspended" && opie.assignee === "user") {
        const prompt = extractPrompt(opie);
        this.#addChatMessage(prompt, "agent");
        if (!this.chatOpen) this.#toggleChat();
      }
    }

    // Digest status toast.
    const digestRunning = tickets.find(
      (t) =>
        t.tags?.includes("digest") &&
        (t.status === "running" || t.status === "available")
    );
    if (digestRunning && !this.statusVisible) {
      this.statusText = "Updating based on recent work...";
      this.statusVisible = true;
    } else if (!digestRunning && this.statusVisible) {
      this.statusVisible = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "opal-shell": OpalShell;
  }
}
