/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unified chat panel — chat log + interactive input UI.
 *
 * Renders the conversation history from `agent.chat_history` and,
 * when the agent is suspended waiting for user input, shows a text
 * reply form or choice selection cards.
 *
 * This component is a built-in surface item composed by
 * `<bees-surface-pane>`, not driven by `surface.json`.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { AgentStore } from "../data/agent-store.js";
import type { MutationClient } from "../data/mutation-client.js";
import type { AgentData } from "../../../common/types.js";
import { markdown } from "../../../common/markdown.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesChatPanel };

// Pidgin file-tag patterns (mirrors bees/pidgin.py).
const FILE_SPLIT_REGEX = /(<file\s+src\s*=\s*"[^"]*"\s*\/>)/;
const FILE_PARSE_REGEX = /^<file\s+src\s*=\s*"([^"]*)"\s*\/>$/;

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg"]);

@customElement("bees-chat-panel")
class BeesChatPanel extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      /* ── Chat log ── */
      .chat-log {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 12px;
        flex: 1;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #334155 transparent;
      }

      .chat-turn {
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 0.8rem;
        line-height: 1.5;
      }

      .chat-turn.user {
        background: #1e293b;
        border: 1px solid #334155;
      }

      .chat-turn.agent {
        background: #111827;
        border: 1px solid #1e293b;
      }

      .chat-role {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 4px;
      }

      .chat-turn.user .chat-role {
        color: #60a5fa;
      }

      .chat-turn.agent .chat-role {
        color: #a78bfa;
      }

      .chat-text {
        color: #e2e8f0;
      }

      .chat-text p {
        margin: 0.3em 0;
      }

      .chat-text p:first-child {
        margin-top: 0;
      }

      .chat-text p:last-child {
        margin-bottom: 0;
      }

      .chat-text code {
        background: #1e293b;
        padding: 1px 5px;
        border-radius: 3px;
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.85em;
      }

      .chat-text pre {
        background: #0f172a;
        border: 1px solid #1e293b;
        border-radius: 4px;
        padding: 8px 12px;
        overflow-x: auto;
        margin: 0.5em 0;
      }

      .chat-text pre code {
        background: none;
        padding: 0;
        font-size: 0.8rem;
      }

      .chat-text ul,
      .chat-text ol {
        margin: 0.4em 0;
        padding-left: 1.5em;
      }

      .chat-text a {
        color: #60a5fa;
      }

      /* ── Embedded media from pidgin <file> tags ── */

      .chat-media {
        max-width: 100%;
        border-radius: 6px;
        margin: 8px 0;
        display: block;
      }

      .chat-audio {
        width: 100%;
        margin: 8px 0;
      }

      .file-placeholder {
        padding: 12px;
        background: #1e293b;
        border: 1px dashed #334155;
        border-radius: 6px;
        color: #64748b;
        font-size: 0.75rem;
        text-align: center;
        margin: 8px 0;
      }

      .file-error {
        padding: 8px 12px;
        background: #1c1917;
        border: 1px solid #991b1b;
        border-radius: 6px;
        color: #f87171;
        font-size: 0.75rem;
        margin: 8px 0;
      }

      .chat-file-link {
        display: inline-block;
        padding: 6px 12px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #60a5fa;
        font-size: 0.8rem;
        text-decoration: none;
        margin: 4px 0;
      }

      .chat-file-link:hover {
        background: #334155;
      }

      .chat-text strong {
        color: #f8fafc;
      }

      /* ── Response form ── */

      .response-section {
        border-top: 1px solid #1e293b;
        padding: 12px;
        flex-shrink: 0;
      }

      .response-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .agent-prompt {
        padding: 12px 16px;
        background: #111827;
        border: 1px solid #1e293b;
        border-radius: 8px;
        color: #e2e8f0;
        font-size: 0.85rem;
        line-height: 1.6;
        max-height: 300px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #334155 transparent;
      }

      .agent-prompt p {
        margin: 0.3em 0;
      }

      .agent-prompt p:first-child {
        margin-top: 0;
      }

      .agent-prompt p:last-child {
        margin-bottom: 0;
      }

      .agent-prompt code {
        background: #1e293b;
        padding: 1px 5px;
        border-radius: 3px;
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.85em;
      }

      .agent-prompt strong {
        color: #f8fafc;
      }

      .reply-textarea {
        width: 100%;
        min-height: 80px;
        padding: 10px 12px;
        background: #0b0c0f;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #e2e8f0;
        font-family: inherit;
        font-size: 0.85rem;
        resize: vertical;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.15s;
      }

      .reply-textarea:focus {
        border-color: #3b82f6;
      }

      .reply-textarea::placeholder {
        color: #475569;
      }

      .reply-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .send-btn {
        padding: 6px 16px;
        font-size: 0.8rem;
        font-weight: 600;
        background: #1d4ed8;
        color: #dbeafe;
        border: 1px solid #2563eb;
        border-radius: 6px;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s;
      }

      .send-btn:hover {
        background: #2563eb;
        color: #fff;
      }

      .send-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      /* ── Choice cards ── */

      .choices-grid {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .choice-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: #111827;
        border: 1px solid #1e293b;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
        font-size: 0.8rem;
        color: #e2e8f0;
      }

      .choice-card:hover {
        background: #1e293b;
        border-color: #334155;
      }

      .choice-card.selected {
        background: #1e3a5f;
        border-color: #3b82f6;
      }

      .choice-indicator {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid #475569;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
      }

      .choice-card.selected .choice-indicator {
        border-color: #3b82f6;
        background: #3b82f6;
      }

      .choice-indicator::after {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: transparent;
        transition: background 0.15s;
      }

      .choice-card.selected .choice-indicator::after {
        background: #fff;
      }

      .choice-label {
        flex: 1;
        line-height: 1.4;
      }

      /* ── Empty state ── */
      .chat-empty {
        padding: 24px;
        text-align: center;
        color: #475569;
        font-size: 0.8rem;
        font-style: italic;
      }

      /* ── Live session panel ── */
      .live-panel {
        border: 1px solid #1e3a5f;
        border-radius: 8px;
        overflow: hidden;
        margin: 8px 12px;
        flex-shrink: 0;
      }

      .live-panel-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: #0c1929;
        border-bottom: 1px solid #1e3a5f;
      }

      .live-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        transition: background 0.3s;
      }

      .live-status-dot.idle { background: #475569; }
      .live-status-dot.connecting { background: #f59e0b; animation: pulse 1s infinite; }
      .live-status-dot.connected { background: #22c55e; animation: pulse 2s infinite; }
      .live-status-dot.disconnected { background: #64748b; }
      .live-status-dot.error { background: #ef4444; }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .live-status-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        flex: 1;
      }

      .live-btn {
        padding: 4px 12px;
        font-size: 0.7rem;
        font-weight: 600;
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s;
        border: 1px solid;
      }

      .live-btn.connect {
        background: #1d4ed8;
        color: #dbeafe;
        border-color: #2563eb;
      }
      .live-btn.connect:hover { background: #2563eb; }

      .live-btn.disconnect {
        background: transparent;
        color: #f87171;
        border-color: #991b1b;
      }
      .live-btn.disconnect:hover { background: #1c1917; }

      .live-mic-bar {
        padding: 8px 14px;
        display: flex;
        gap: 8px;
        align-items: center;
        border-top: 1px solid #1e293b;
      }
    `,
  ];

  @property({ attribute: false })
  accessor agentStore: AgentStore | null = null;

  @property({ attribute: false })
  accessor mutationClient: MutationClient | null = null;

  @state() accessor replyText = "";
  @state() accessor selectedChoiceIds = new Set<string>();
  @state() accessor responding = false;

  /** Track message count to detect new arrivals. */
  #lastMessageCount = 0;

  /**
   * Whether the user was scrolled near the bottom before the last
   * render. If true, we auto-scroll after rendering new messages.
   */
  #wasNearBottom = true;

  /**
   * Whether this panel has visible content — chat messages or pending
   * user input. Used by the parent to decide grid layout.
   */
  get hasContent(): boolean {
    const agent = this.agentStore?.selectedAgent.get();
    if (!agent) return false;
    return hasChatContent(agent);
  }

  render() {
    if (!this.agentStore) return nothing;
    const agent = this.agentStore.selectedAgent.get();
    if (!agent) return nothing;

    const chatHistory = (agent.chat_history ?? []).filter(
      (m) => m.text.trim() !== ""
    );

    // Snapshot scroll position before re-render.
    const chatLog = this.renderRoot.querySelector(".chat-log");
    if (chatLog) {
      const { scrollTop, scrollHeight, clientHeight } = chatLog;
      this.#wasNearBottom = scrollHeight - scrollTop - clientHeight < 60;
    }

    // Detect new messages.
    const messageCount = chatHistory.length;
    const hasNewMessages = messageCount > this.#lastMessageCount;
    this.#lastMessageCount = messageCount;

    const inputUi = this.renderInputUi(agent);
    if (chatHistory.length === 0 && !inputUi) return nothing;

    // Schedule auto-scroll after render if there are new messages
    // and the user was near the bottom.
    if (hasNewMessages && this.#wasNearBottom) {
      this.updateComplete.then(() => this.#scrollToBottom());
    }

    const displayHistory = chatHistory;

    return html`
      <div class="chat-container">
        ${displayHistory.length > 0
          ? html`
              <div class="chat-log">
                ${displayHistory.map(
                  (m) => html`
                    <div
                       class="chat-turn ${m.role === "user" ? "user" : "agent"}"
                    >
                      <div class="chat-role">${m.role}</div>
                      <div class="chat-text">${this.#renderChatText(agent.id, m.text)}</div>
                    </div>
                  `
                )}
              </div>
            `
          : nothing}
        ${agent.runner === "live" ? this.renderLiveSessionPanel(agent.id) : nothing}
        ${inputUi
          ? html`<div class="response-section">${inputUi}</div>`
          : nothing}
      </div>
    `;
  }

  // ── Pidgin file-tag resolution ──

  /** Cache of resolved file data URLs. Keys are `agentId:path`. */
  #fileCache = new Map<string, string | null>();

  /**
   * Look up (or kick off) an async file read.
   *
   * Returns the data-URL string when resolved, `null` while loading,
   * or `""` when the file could not be read.
   */
  #resolveFile(agentId: string, src: string): string | null {
    const key = `${agentId}:${src}`;
    if (this.#fileCache.has(key)) return this.#fileCache.get(key)!;

    // Mark as in-flight.
    this.#fileCache.set(key, null);
    const segments = src.split("/");
    this.agentStore!.readFileContent(agentId, segments).then((dataUrl) => {
      this.#fileCache.set(key, dataUrl ?? "");
      this.requestUpdate();
    });
    return null;
  }

  /** Render chat text, replacing `<file>` tags with embedded media. */
  #renderChatText(agentId: string, text: string): unknown {
    if (!text.includes("<file")) return markdown(text);

    const segments = text.split(FILE_SPLIT_REGEX);
    return segments.map((segment) => {
      const match = segment.match(FILE_PARSE_REGEX);
      if (match) {
        const src = match[1];
        const resolved = this.#resolveFile(agentId, src);
        if (resolved === null) {
          return html`<div class="file-placeholder">Loading ${src}…</div>`;
        }
        if (resolved === "") {
          return html`<div class="file-error">⚠ Could not load ${src}</div>`;
        }
        return this.#renderMedia(src, resolved);
      }
      return segment ? markdown(segment) : nothing;
    });
  }

  /** Render a resolved file as the appropriate media element. */
  #renderMedia(src: string, dataUrl: string): unknown {
    const ext = "." + (src.split(".").pop()?.toLowerCase() ?? "");
    if (IMAGE_EXTS.has(ext)) {
      return html`<img class="chat-media" src="${dataUrl}" alt="${src}" />`;
    }
    if (VIDEO_EXTS.has(ext)) {
      return html`<video class="chat-media" src="${dataUrl}" controls></video>`;
    }
    if (AUDIO_EXTS.has(ext)) {
      return html`<audio class="chat-audio" src="${dataUrl}" controls></audio>`;
    }
    return html`<a class="chat-file-link" href="${dataUrl}" download="${src}"
      >📎 ${src}</a
    >`;
  }

  private renderLiveSessionPanel(agentId: string) {
    const hasActive = this.agentStore?.activeLiveSessions
      .get()
      .has(agentId);

    const client = this.agentStore?.activeConnection.get();
    const isThisAgent = client?.taskId === agentId;
    const status = isThisAgent ? (client!.status.get()) : "idle";
    const isTalking = isThisAgent ? (client!.talking.get()) : false;

    if (!hasActive && status === "idle") return nothing;

    const isConnected = status === "connected";
    const isConnecting = status === "connecting";

    return html`
      <div class="block live-panel">
        <div class="live-panel-header">
          <span class="live-status-dot ${status}"></span>
          <span class="live-status-label">Live Session — ${status}</span>
          <button
            class="live-btn ${isConnected ? "disconnect" : "connect"}"
            ?disabled=${isConnecting}
            @click=${() => this.handleLiveConnectToggle(agentId)}
          >
            ${isConnecting
              ? "Connecting…"
              : isConnected
                ? "Stop Session"
                : "Start Session"}
          </button>
        </div>
        ${isConnected
          ? html`<div class="live-mic-bar" style="font-size:0.8rem; color:#94a3b8; display:flex; align-items:center; gap:8px;">
              <span class="live-status-dot ${isTalking ? "connected" : "idle"}" style="animation: none;"></span>
              <span>${isTalking ? "Streaming audio (Voice active)" : "Microphone active (Quiet)"}</span>
            </div>`
          : nothing}
      </div>
    `;
  }

  private async handleLiveConnectToggle(agentId: string): Promise<void> {
    if (!this.agentStore) return;

    const client = this.agentStore.activeConnection.get();

    if (client && client.taskId === agentId) {
      this.agentStore.disconnectLiveSession();
    } else {
      await this.agentStore.connectLiveSession(agentId);
    }
  }

  // ── Input UI ──

  /** Render the interactive input area, or null if not applicable. */
  private renderInputUi(agent: AgentData): unknown {
    if (agent.status !== "suspended" || !agent.suspend_event) return null;

    const functionName = agent.suspend_event.function_name as
      | string
      | undefined;
    const isUserFacing =
      agent.assignee === "user" &&
      functionName !== "chat_await_context_update" &&
      functionName !== "tasks_await" &&
      functionName !== "agents_await" &&
      functionName !== "events_yield";

    if (!isUserFacing || !this.mutationClient?.boxActive.get()) return null;

    const waitForInput = agent.suspend_event.waitForInput as
      | Record<string, unknown>
      | undefined;
    const waitForChoice = agent.suspend_event.waitForChoice as
      | Record<string, unknown>
      | undefined;

    if (waitForInput) return this.renderReplyForm(agent.id, waitForInput);
    if (waitForChoice) return this.renderChoiceForm(agent.id, waitForChoice);
    return null;
  }

  /**
   * Render an LLMContent prompt, including both text and inline media.
   *
   * After pidgin resolution on the server, prompts contain a mix of
   * text parts and inlineData parts (images, audio, video). This method
   * renders all of them instead of discarding non-text parts.
   */
  #renderPromptContent(prompt: unknown): unknown {
    if (!prompt || typeof prompt !== "object") return null;
    const p = prompt as {
      parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
    };
    if (!Array.isArray(p.parts) || p.parts.length === 0) return null;

    const rendered = p.parts.map((part) => {
      if (part.text) return markdown(part.text);
      if (part.inlineData) {
        const { mimeType, data } = part.inlineData;
        const dataUrl = `data:${mimeType};base64,${data}`;
        if (mimeType.startsWith("image/")) {
          return html`<img class="chat-media" src="${dataUrl}" alt="embedded image" />`;
        }
        if (mimeType.startsWith("video/")) {
          return html`<video class="chat-media" src="${dataUrl}" controls></video>`;
        }
        if (mimeType.startsWith("audio/")) {
          return html`<audio class="chat-audio" src="${dataUrl}" controls></audio>`;
        }
      }
      return nothing;
    });

    // Return null if every part resolved to nothing.
    return rendered.some((r) => r !== nothing) ? rendered : null;
  }

  /** Interactive text reply form for waitForInput suspensions. */
  private renderReplyForm(
    ticketId: string,
    _waitForInput: Record<string, unknown>
  ) {
    return html`
      <div class="response-form">
        <textarea
          class="reply-textarea"
          placeholder="Type your reply…"
          .value=${this.replyText}
          ?disabled=${this.responding}
          @input=${(e: Event) => {
            this.replyText = (e.target as HTMLTextAreaElement).value;
          }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (this.replyText.trim()) {
                this.handleTextReply(ticketId);
              }
            }
          }}
        ></textarea>
        <div class="reply-actions">
          <button
            class="send-btn"
            ?disabled=${!this.replyText.trim() || this.responding}
            @click=${() => this.handleTextReply(ticketId)}
          >
            ${this.responding ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    `;
  }

  /** Interactive choice selection form for waitForChoice suspensions. */
  private renderChoiceForm(
    ticketId: string,
    waitForChoice: Record<string, unknown>
  ) {
    const choices = (waitForChoice.choices ?? []) as Array<{
      id: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
    const selectionMode =
      (waitForChoice.selectionMode as string) ?? "single";

    return html`
      <div class="response-form">
        <div class="choices-grid">
          ${choices.map((choice) => {
            const selected = this.selectedChoiceIds.has(choice.id);
            const choiceContent = this.#renderPromptContent(choice.content);
            const label = choiceContent || choice.id;
            return html`
              <div
                class="choice-card ${selected ? "selected" : ""}"
                @click=${() => this.toggleChoice(choice.id, selectionMode)}
              >
                <div class="choice-indicator"></div>
                <span class="choice-label">${label}</span>
              </div>
            `;
          })}
        </div>
        <div class="reply-actions">
          <button
            class="send-btn"
            ?disabled=${this.selectedChoiceIds.size === 0 || this.responding}
            @click=${() => this.handleChoiceReply(ticketId)}
          >
            ${this.responding ? "Sending…" : "Confirm"}
          </button>
        </div>
      </div>
    `;
  }

  // ── Interaction handlers ──

  private toggleChoice(choiceId: string, mode: string) {
    const next = new Set(this.selectedChoiceIds);
    if (mode === "single") {
      if (next.has(choiceId)) {
        next.clear();
      } else {
        next.clear();
        next.add(choiceId);
      }
    } else {
      if (next.has(choiceId)) {
        next.delete(choiceId);
      } else {
        next.add(choiceId);
      }
    }
    this.selectedChoiceIds = next;
  }

  private async handleTextReply(ticketId: string) {
    const text = this.replyText.trim();
    if (!text || !this.mutationClient) return;

    this.responding = true;
    try {
      await this.mutationClient.respondToTask(ticketId, {
        input: {
          parts: [{ text }],
          role: "user",
        },
      });
      this.replyText = "";
    } catch (e) {
      console.error("Failed to send reply:", e);
    } finally {
      this.responding = false;
    }
  }

  private async handleChoiceReply(ticketId: string) {
    if (this.selectedChoiceIds.size === 0 || !this.mutationClient) return;

    this.responding = true;
    try {
      await this.mutationClient.respondToTask(ticketId, {
        selected: {
          ids: [...this.selectedChoiceIds],
        },
      });
      this.selectedChoiceIds = new Set();
    } catch (e) {
      console.error("Failed to send choice:", e);
    } finally {
      this.responding = false;
    }
  }



  /** Scroll the chat log container to the bottom. */
  #scrollToBottom() {
    const chatLog = this.renderRoot.querySelector(".chat-log");
    if (chatLog) {
      chatLog.scrollTop = chatLog.scrollHeight;
    }
  }
}

/**
 * Whether an agent has chat content — messages or pending user input.
 * Exported for use by parent components (tab visibility probing).
 */
export function hasChatContent(agent: AgentData): boolean {
  const hasMessages = (agent.chat_history ?? []).some(
    (m) => m.text.trim() !== ""
  );
  if (hasMessages) return true;

  if (agent.status === "suspended" && agent.suspend_event) {
    const fn = agent.suspend_event.function_name as string | undefined;
    const isUserFacing =
      agent.assignee === "user" &&
      fn !== "chat_await_context_update" &&
      fn !== "tasks_await" &&
      fn !== "agents_await" &&
      fn !== "events_yield";
    if (isUserFacing) {
      const hasInput = !!agent.suspend_event.waitForInput;
      const hasChoice = !!agent.suspend_event.waitForChoice;
      if (hasInput || hasChoice) return true;
    }
  }

  return false;
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-chat-panel": BeesChatPanel;
  }
}
