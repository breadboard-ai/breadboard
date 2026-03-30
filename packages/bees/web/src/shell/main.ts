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

import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";

import { BeesAPI } from "../data/api.js";
import { BeesConnection } from "../data/connection.js";
import { BeesState } from "../data/state.js";
import type { TicketData } from "../data/types.js";
import { extractPrompt, extractChoices } from "../utils.js";
import type { Choice } from "../utils.js";
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
  @state() private digestTicketId: string | null = null;
  @state() private pendingChoices: Choice[] = [];
  @state() private pendingSelectionMode: "single" | "multiple" = "single";
  @state() private selectedChoiceIds: string[] = [];

  private connection = new BeesConnection(appState);
  private api = new BeesAPI();
  private eventSource: EventSource | null = null;
  private bridge: MessageBridge | null = null;
  private previousOpieStatus: string | null = null;
  private stateWatchInterval: ReturnType<typeof setInterval> | null = null;
  private lastDigestUpdateId: string | null = null;
  private digestLoading = false;
  private chatRestored = false;

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
    const showBack =
      this.currentView !== null && this.currentView !== this.digestTicketId;
    return html`
      <header>
        <div class="brand">
          ${showBack
            ? html`<button
                class="back-button"
                @click=${this.#navigateToDigest}
                aria-label="Back to Digest"
              >
                ← Digest
              </button>`
            : html`<span class="brand-icon">◇</span> Opal`}
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
          : html`
              <iframe
                src="/iframe.html"
                title="Digest View"
                sandbox="allow-scripts allow-same-origin allow-popups"
              ></iframe>
            `}
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
          ${this.#groupedMessages().map((group) => {
            if (group.length === 1) {
              const m = group[0];
              return html`<div class="chat-msg ${m.role}">
                ${m.role === "agent" ? markdown(m.text) : m.text}
              </div>`;
            }
            // Multiple consecutive agent messages — first is the primary,
            // rest are status updates that fold into the bubble.
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
        ${this.pendingChoices.length > 0
          ? this.#renderChoiceInput()
          : this.#renderTextInput()}
      </div>
    `;
  }

  #renderTextInput() {
    return html`
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
    `;
  }

  #renderChoiceInput() {
    const isMultiple = this.pendingSelectionMode === "multiple";
    return html`
      <div class="chat-choices-area">
        <div class="chat-chips">
          ${this.pendingChoices.map((c) => {
            const selected = this.selectedChoiceIds.includes(c.id);
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
              ?disabled=${this.selectedChoiceIds.length === 0}
              @click=${this.#sendChoices}
            >
              Send Selection
            </button>`
          : null}
      </div>
    `;
  }

  // ── Chat logic ───────────────────────────────────────────────────

  /**
   * Group consecutive agent messages so status updates render inside
   * the previous agent bubble rather than as separate bubbles.
   *
   * Returns an array of arrays — each inner array is a "group":
   * - Single-element group: a user/thought/tool message
   * - Multi-element group: consecutive agent messages (first is the
   *   primary bubble, rest are status updates)
   */
  #groupedMessages(): ChatMessage[][] {
    const groups: ChatMessage[][] = [];
    for (const m of this.chatMessages) {
      if (
        m.role === "agent" &&
        groups.length > 0 &&
        groups[groups.length - 1][0].role === "agent"
      ) {
        // Append to the current agent group.
        groups[groups.length - 1].push(m);
      } else {
        groups.push([m]);
      }
    }
    return groups;
  }

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

  #onChipClick(choiceId: string, isMultiple: boolean) {
    if (isMultiple) {
      // Toggle in the selection set.
      if (this.selectedChoiceIds.includes(choiceId)) {
        this.selectedChoiceIds = this.selectedChoiceIds.filter(
          (id) => id !== choiceId
        );
      } else {
        this.selectedChoiceIds = [...this.selectedChoiceIds, choiceId];
      }
    } else {
      // Single-select: tap sends immediately.
      this.#sendChoiceIds([choiceId]);
    }
  }

  async #sendChoices() {
    if (this.selectedChoiceIds.length === 0) return;
    this.#sendChoiceIds(this.selectedChoiceIds);
  }

  async #sendChoiceIds(ids: string[]) {
    const opie = this.#findOpieTicket();
    if (!opie) return;

    // Show what was selected as a user message.
    const labels = ids
      .map((id) => this.pendingChoices.find((c) => c.id === id)?.text ?? id)
      .join(", ");
    this.#addChatMessage(labels, "user");

    this.pendingChoices = [];
    this.selectedChoiceIds = [];

    await this.api.respond(opie.id, undefined, ids);
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

  async #loadBundle(ticketId: string) {
    const [code, css] = await Promise.all([
      this.api.getFile(ticketId, "bundle.js"),
      this.api.getFile(ticketId, "bundle.css"),
    ]);

    if (!code) {
      console.error(`[opal-shell] Missing bundle.js for ticket ${ticketId}`);
      return;
    }

    // Wait for the iframe DOM element to be rendered
    this.requestUpdate();
    await this.updateComplete;

    const iframe = this.renderRoot.querySelector("iframe");
    if (!iframe) return;

    if (this.bridge) {
      this.bridge.dispose();
    }

    this.bridge = new MessageBridge(iframe);
    this.bridge.onMessage((msg) => {
      if (msg.type === "navigate") {
        this.#navigateToTicket(msg.viewId);
      } else if (msg.type === "emit") {
        console.log("[opal-shell] iframe emitted", msg.event, msg.payload);
      }
    });

    await this.bridge.send({
      type: "render",
      code,
      css: css || undefined,
      props: {},
      assets: {},
    });
  }

  async #navigateToTicket(ticketId: string) {
    if (ticketId === "digest" && this.digestTicketId) {
      this.currentView = this.digestTicketId;
      await this.#loadBundle(this.digestTicketId);
      return;
    }
    this.currentView = ticketId;
    this.statusText = "Loading...";
    this.statusVisible = true;
    await this.#loadBundle(ticketId);
    this.statusVisible = false;
  }

  #navigateToDigest() {
    if (this.digestTicketId) {
      this.#navigateToTicket("digest");
    }
  }

  /**
   * Watch the reactive state for Opie-relevant transitions.
   * Runs on a 1s interval (will migrate to Signal.effect / SCA triggers
   * once the full SCA architecture is in place).
   */
  #watchState() {
    const tickets = appState.tickets.get();
    const opie = tickets.find((t) => t.tags?.includes("opie"));

    if (!opie) return;

    // Restore chat history from the ticket on first discovery
    // (handles page reload / server restart).
    if (!this.chatRestored && opie.chat_history?.length) {
      this.chatRestored = true;
      this.chatMessages = opie.chat_history.map((m) => ({
        text: m.text,
        role: m.role as ChatMessage["role"],
      }));
      this.#scrollChatToBottom();
    }

    // Detect state transitions.
    const currentStatus = `${opie.status}:${opie.assignee ?? ""}`;
    if (currentStatus !== this.previousOpieStatus) {
      this.previousOpieStatus = currentStatus;

      // When Opie suspends waiting for user input, show the prompt.
      if (opie.status === "suspended" && opie.assignee === "user") {
        const prompt = extractPrompt(opie);
        this.#addChatMessage(prompt, "agent");

        // Present choices if the suspend is a waitForChoice.
        const choices = extractChoices(opie);
        if (choices.length > 0) {
          const selectionMode =
            ((opie.suspend_event?.waitForChoice as Record<string, unknown>)
              ?.selectionMode as string) ?? "single";
          this.pendingChoices = choices;
          this.pendingSelectionMode =
            selectionMode === "multiple" ? "multiple" : "single";
          this.selectedChoiceIds = [];
        } else {
          this.pendingChoices = [];
        }

        if (!this.chatOpen) this.#toggleChat();
      }
    }

    // Digest: find the digest-tagged ticket (any non-coordination ticket
    // that is suspended or completed — the infinite digest agent stays
    // suspended between update cycles).
    const digestTicket = tickets.find(
      (t) =>
        t.kind !== "coordination" &&
        t.tags?.includes("digest") &&
        (t.status === "suspended" || t.status === "completed")
    );

    if (digestTicket && !this.digestLoading) {
      const isNew = !this.digestTicketId;
      if (isNew) {
        this.digestTicketId = digestTicket.id;
        this.currentView = digestTicket.id;
      }

      // Find the latest digest_update coordination ticket (skip over older
      // ones so we don't reload once per stale ticket).
      const allDigestUpdates = tickets.filter(
        (t) =>
          t.kind === "coordination" &&
          t.signal_type === "digest_update"
      );
      const latest = allDigestUpdates[allDigestUpdates.length - 1];
      const hasNewUpdate =
        latest != null && latest.id !== this.lastDigestUpdateId;

      // Always track the latest so we don't re-process it later.
      if (hasNewUpdate) this.lastDigestUpdateId = latest.id;

      // Only load the bundle when the digest is the active view.
      // If the user is viewing an app, the digest reload will happen
      // when they navigate back.
      const digestIsActive = this.currentView === this.digestTicketId;
      if ((isNew || hasNewUpdate) && digestIsActive) {
        this.digestLoading = true;
        this.statusText = isNew ? "Loading digest..." : "Refreshing digest...";
        this.statusVisible = true;
        this.#loadBundle(this.digestTicketId!).then(() => {
          this.statusVisible = false;
          this.digestLoading = false;
        });
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "opal-shell": OpalShell;
  }
}
