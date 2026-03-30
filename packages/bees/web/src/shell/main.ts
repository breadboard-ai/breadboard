/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `<opal-shell>` — the Opal 2.0 magazine view.
 *
 * A Lit + SignalWatcher custom element that provides:
 * - A threaded chat overlay supporting multiple agent conversations
 * - A main stage iframe for digest / mini-app rendering
 * - An unobtrusive status toast for background activity
 *
 * Chat threads are derived from tickets: each unique combination of
 * "chat" tag + playbook_run_id forms a thread. Opie is the default
 * thread. A side rail appears when multiple threads are active.
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

interface ChatThread {
  id: string;
  title: string;
  ticketIds: string[];
  activeTicketId: string | null;
  hasUnread: boolean;
}

const appState = new BeesState();

@customElement("opal-shell")
class OpalShell extends SignalWatcher(LitElement) {
  @state() private chatOpen = false;
  @state() private chatInput = "";
  @state() private threads: ChatThread[] = [];
  @state() private activeThreadId = "opie";
  @state() private threadMessages = new Map<string, ChatMessage[]>();
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
  private previousTicketStatuses = new Map<string, string>();
  private stateWatchInterval: ReturnType<typeof setInterval> | null = null;
  private lastDigestUpdateId: string | null = null;
  private digestLoading = false;
  private restoredThreadIds = new Set<string>();
  private visitedThreadIds = new Set<string>(["opie"]);

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
    const thread = this.#activeThread;
    const messages = this.threadMessages.get(this.activeThreadId) ?? [];
    const showRail = this.threads.length > 1;

    return html`
      <div class="chat-overlay ${this.chatOpen ? "open" : ""}">
        <div class="chat-header">
          <span class="chat-title">${thread?.title ?? "Chat"}</span>
          <button
            class="chat-close"
            @click=${this.#toggleChat}
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
                  ${m.role === "agent" ? markdown(m.text) : m.text}
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
        ${this.pendingChoices.length > 0
          ? this.#renderChoiceInput()
          : this.#renderTextInput()}
      </div>
    `;
  }

  #renderThreadRail() {
    return html`
      <div class="thread-rail">
        ${this.threads.map(
          (t) => html`
            <button
              class="thread-item ${t.id === this.activeThreadId ? "active" : ""}"
              @click=${() => this.#switchThread(t.id)}
            >
              <span class="thread-item-title">${t.title}</span>
              ${t.hasUnread
                ? html`<span class="thread-unread"></span>`
                : null}
            </button>
          `
        )}
      </div>
    `;
  }

  #renderTextInput() {
    return html`
      <div class="chat-input-area">
        <input
          type="text"
          placeholder="Type a message..."
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
  #groupedMessages(messages: ChatMessage[]): ChatMessage[][] {
    const groups: ChatMessage[][] = [];
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

    const thread = this.#activeThread;
    if (!thread?.activeTicketId) return;

    this.#addChatMessage(text, "user");
    this.chatInput = "";
    this.#scrollChatToBottom();

    await this.api.respond(thread.activeTicketId, text);
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
    const thread = this.#activeThread;
    if (!thread?.activeTicketId) return;

    const labels = ids
      .map((id) => this.pendingChoices.find((c) => c.id === id)?.text ?? id)
      .join(", ");
    this.#addChatMessage(labels, "user");

    this.pendingChoices = [];
    this.selectedChoiceIds = [];

    await this.api.respond(thread.activeTicketId, labels, ids);
  }

  #addChatMessage(text: string, role: ChatMessage["role"]) {
    const id = this.activeThreadId;
    const current = this.threadMessages.get(id) ?? [];
    const updated = new Map(this.threadMessages);
    updated.set(id, [...current, { text, role }]);
    this.threadMessages = updated;
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

      // Only show live events for tickets in the active thread.
      const thread = this.#activeThread;
      if (!thread || !thread.ticketIds.includes(ticketId)) return;

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

  get #activeThread(): ChatThread | undefined {
    return this.threads.find((t) => t.id === this.activeThreadId);
  }

  #switchThread(threadId: string) {
    if (this.activeThreadId === threadId) return;
    this.activeThreadId = threadId;
    this.visitedThreadIds.add(threadId);

    // Clear ephemeral state from the previous thread.
    this.pendingChoices = [];
    this.selectedChoiceIds = [];

    // Mark the thread as read.
    const thread = this.#activeThread;
    if (thread?.hasUnread) {
      this.threads = this.threads.map((t) =>
        t.id === threadId ? { ...t, hasUnread: false } : t
      );
    }

    // Re-derive prompt state for the new thread's active ticket.
    this.#applyPromptState();
    this.#scrollChatToBottom();
  }

  /**
   * Derive chat threads from the current ticket state.
   *
   * A thread groups all "chat"-tagged tickets that share an identity:
   * - Opie: tickets also tagged "opie" → thread id "opie"
   * - Others: grouped by playbook_run_id
   *
   * Within a thread, tickets are ordered by creation time. The "active"
   * ticket is the latest one suspended for user input, or the latest
   * one running.
   */
  #deriveThreads(): ChatThread[] {
    const tickets = appState.tickets.get();
    const chatTickets = tickets.filter((t) => t.tags?.includes("chat"));

    const groups = new Map<string, TicketData[]>();

    for (const t of chatTickets) {
      const threadId = t.tags?.includes("opie")
        ? "opie"
        : t.playbook_run_id;
      if (!threadId) continue;
      const list = groups.get(threadId) ?? [];
      list.push(t);
      groups.set(threadId, list);
    }

    const threads: ChatThread[] = [];

    for (const [threadId, group] of groups) {
      // Sort by creation time (oldest first).
      group.sort(
        (a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")
      );

      // Active ticket: prefer suspended-for-user, then running.
      const suspendedForUser = group.findLast(
        (t) => t.status === "suspended" && t.assignee === "user"
      );
      const running = group.findLast((t) => t.status === "running");
      const activeTicketId =
        suspendedForUser?.id ?? running?.id ?? null;

      // Thread title: Opie is always "Opie". Others use the active
      // ticket's title so it reflects who the user is talking to.
      let title: string;
      if (threadId === "opie") {
        title = "Opie";
      } else {
        const activeTicket = activeTicketId
          ? group.find((t) => t.id === activeTicketId)
          : null;
        title =
          activeTicket?.title ??
          group[group.length - 1]?.title ??
          threadId.slice(0, 8);
      }

      // Unread: a non-active thread has a ticket waiting for user.
      const hasUnread =
        threadId !== this.activeThreadId && suspendedForUser != null;

      threads.push({
        id: threadId,
        title,
        ticketIds: group.map((t) => t.id),
        activeTicketId,
        hasUnread,
      });
    }

    return threads;
  }

  /**
   * Restore chat history for a thread from its tickets' chat_history fields.
   * Concatenates histories in ticket-creation order for seamless handoff.
   */
  #restoreThreadHistory(thread: ChatThread) {
    const tickets = appState.tickets.get();
    const messages: ChatMessage[] = [];

    for (const ticketId of thread.ticketIds) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) continue;

      // Seed the status tracker so #watchState() doesn't re-fire for
      // the current state — the prompt is already in the chat log.
      this.previousTicketStatuses.set(
        ticketId,
        `${ticket.status}:${ticket.assignee ?? ""}`
      );

      if (!ticket.chat_history?.length) continue;
      for (const m of ticket.chat_history) {
        messages.push({
          text: m.text,
          role: m.role as ChatMessage["role"],
        });
      }
    }

    if (messages.length > 0) {
      const updated = new Map(this.threadMessages);
      updated.set(thread.id, messages);
      this.threadMessages = updated;
    }
  }

  /**
   * Apply prompt / choices state from the active thread's active ticket.
   * Called on thread switch and on state transitions.
   */
  #applyPromptState() {
    const thread = this.#activeThread;
    if (!thread?.activeTicketId) {
      this.pendingChoices = [];
      return;
    }

    const tickets = appState.tickets.get();
    const ticket = tickets.find((t) => t.id === thread.activeTicketId);
    if (!ticket || ticket.status !== "suspended" || ticket.assignee !== "user") {
      this.pendingChoices = [];
      return;
    }

    const choices = extractChoices(ticket);
    if (choices.length > 0) {
      const selectionMode =
        ((ticket.suspend_event?.waitForChoice as Record<string, unknown>)
          ?.selectionMode as string) ?? "single";
      this.pendingChoices = choices;
      this.pendingSelectionMode =
        selectionMode === "multiple" ? "multiple" : "single";
      this.selectedChoiceIds = [];
    } else {
      this.pendingChoices = [];
    }
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
   * Watch the reactive state for thread transitions.
   * Runs on a 1s interval.
   */
  #watchState() {
    // Derive threads from current ticket state.
    this.threads = this.#deriveThreads();

    // Restore chat history for any thread not yet restored.
    for (const thread of this.threads) {
      if (!this.restoredThreadIds.has(thread.id)) {
        this.restoredThreadIds.add(thread.id);
        this.#restoreThreadHistory(thread);
        if (thread.id === this.activeThreadId) {
          this.#scrollChatToBottom();
        }
      }
    }

    // Detect state transitions for all chat tickets across all threads.
    const tickets = appState.tickets.get();
    for (const thread of this.threads) {
      for (const ticketId of thread.ticketIds) {
        const ticket = tickets.find((t) => t.id === ticketId);
        if (!ticket) continue;

        const currentStatus = `${ticket.status}:${ticket.assignee ?? ""}`;
        const previousStatus = this.previousTicketStatuses.get(ticketId);

        if (currentStatus !== previousStatus) {
          this.previousTicketStatuses.set(ticketId, currentStatus);

          // When a chat ticket suspends waiting for user input, show prompt.
          if (ticket.status === "suspended" && ticket.assignee === "user") {
            // Add the agent prompt to this thread's messages.
            const prompt = extractPrompt(ticket);
            const threadMessages =
              this.threadMessages.get(thread.id) ?? [];
            const updated = new Map(this.threadMessages);
            updated.set(thread.id, [
              ...threadMessages,
              { text: prompt, role: "agent" as const },
            ]);
            this.threadMessages = updated;

            if (thread.id === this.activeThreadId) {
              // Active thread — just update prompt state.
              this.#applyPromptState();
              this.#scrollChatToBottom();
              if (!this.chatOpen) this.#toggleChat();
            } else if (!this.visitedThreadIds.has(thread.id)
                       && !this.chatInput.trim()) {
              // First contact with this thread and user isn't
              // composing — auto-switch to it.
              this.#switchThread(thread.id);
              this.#applyPromptState();
              this.#scrollChatToBottom();
              if (!this.chatOpen) this.#toggleChat();
            }
          }
        }
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
