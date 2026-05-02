/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Timeline content for a selected ticket — the "Detail" tab body.
 *
 * Renders context, objective, chat history, outcome, error, suspend
 * event, tags, functions, watch events, and the ticket's file tree.
 * The header, identity chips, and tab bar are owned by
 * `<bees-ticket-pane>`.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { TicketStore, FileTreeNode } from "../data/ticket-store.js";
import type { MutationClient } from "../data/mutation-client.js";
import { sharedStyles } from "./shared-styles.js";
import { renderJson } from "./json-tree.js";
import { jsonTreeStyles } from "./json-tree.styles.js";
import "./truncated-text.js";

export { BeesTicketDetail };

@customElement("bees-ticket-detail")
class BeesTicketDetail extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    jsonTreeStyles,
    css`
      /* ── File tree ── */
      .file-tree {
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.75rem;
        line-height: 1.4;
        white-space: normal;
        padding: 8px 12px;
      }

      .file-tree details {
        border: none;
        border-radius: 0;
        overflow: visible;
      }

      .file-tree summary {
        cursor: pointer;
        user-select: none;
        padding: 3px 0;
        color: #e2e8f0;
        list-style: none;
        display: flex;
        align-items: center;
        gap: 6px;
        border-radius: 4px;
        padding-left: 4px;
        transition: background 0.1s;
      }

      .file-tree summary:hover {
        background: #1e293b;
      }

      .file-tree summary::-webkit-details-marker {
        display: none;
      }

      .file-dir > summary::before {
        content: "▸";
        color: #475569;
        font-size: 0.6rem;
        width: 10px;
        text-align: center;
        flex-shrink: 0;
      }

      .file-dir[open] > summary::before {
        content: "▾";
      }

      .file-leaf > summary::before {
        content: "";
        width: 10px;
        flex-shrink: 0;
      }

      .file-children {
        margin-left: 16px;
        border-left: 1px solid #1e293b;
        padding-left: 4px;
      }

      .file-content {
        margin: 2px 0 6px 20px;
        padding: 8px 12px;
        background: #0a0b0e;
        border: 1px solid #1e293b;
        border-radius: 6px;
        overflow-x: auto;
        max-height: 400px;
        overflow-y: auto;
        white-space: normal;
      }

      .file-text {
        margin: 0;
        padding: 0;
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.7rem;
        line-height: 1.5;
        color: #cbd5e1;
        white-space: pre-wrap;
        word-break: break-word;
      }

      /* ── Live session panel ── */

      .live-panel {
        border: 1px solid #1e3a5f;
        border-radius: 8px;
        overflow: hidden;
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

      .live-btn.mic {
        background: transparent;
        color: #94a3b8;
        border-color: #334155;
      }
      .live-btn.mic:hover { background: #1e293b; color: #e2e8f0; }
      .live-btn.mic.active {
        background: #065f4633;
        color: #34d399;
        border-color: #10b981;
      }
      .live-btn.mic.active:hover { background: #065f4666; }

      .live-mic-bar {
        padding: 8px 14px;
        display: flex;
        gap: 8px;
        align-items: center;
        border-top: 1px solid #1e293b;
      }

      .live-transcript {
        padding: 10px 14px;
        max-height: 200px;
        overflow-y: auto;
        font-size: 0.8rem;
        line-height: 1.5;
        color: #cbd5e1;
        white-space: pre-wrap;
        word-break: break-word;
        background: #0a0f1a;
      }

      .live-transcript-empty {
        color: #475569;
        font-style: italic;
      }
    `,
  ];

  @property({ attribute: false })
  accessor ticketStore: TicketStore | null = null;

  @property({ attribute: false })
  accessor mutationClient: MutationClient | null = null;

  /** ID of a recently updated ticket (for flash animation). */
  @property({ attribute: false })
  accessor flashTicketId: string | null = null;

  @state() accessor fileTree: FileTreeNode[] = [];
  @state() accessor fileContents: Record<string, string | null> = {};

  // Live session state is owned by TicketStore.activeConnection —
  // no local client reference needed.

  /** Track the ticket ID we loaded the tree for. */
  #treeLoadedFor: string | null = null;

  render() {
    if (!this.ticketStore) return nothing;
    const ticket = this.ticketStore.selectedTicket.get();
    if (!ticket)
      return html`<div class="empty-state">
        Select a ticket to view details
      </div>`;

    // Reset file tree if ticket changed.
    if (this.#treeLoadedFor !== ticket.id) {
      this.fileTree = [];
      this.fileContents = {};
      this.#treeLoadedFor = ticket.id;
    }



    return html`
      <div class="timeline">
        ${ticket.context
          ? html`
              <div class="context-card">
                <div class="context-label">Context</div>
                <bees-truncated-text
                  threshold="300"
                  max-height="150"
                  fadeBg="#111827"
                  >${ticket.context}</bees-truncated-text
                >
              </div>
            `
          : nothing}
        ${ticket.objective &&
        ticket.objective.trim() !== (ticket.context ?? "").trim()
          ? html`
              <div class="block">
                <div class="block-header">Objective</div>
                <div class="block-content">
                  <bees-truncated-text
                    threshold="500"
                    max-height="200"
                    fadeBg="#0f1115"
                    >${ticket.objective}</bees-truncated-text
                  >
                </div>
              </div>
            `
          : nothing}

        ${ticket.outcome
          ? html`
              <div class="block outcome">
                <div class="block-header">Outcome</div>
                <div class="block-content">
                  <bees-truncated-text
                    threshold="300"
                    max-height="150"
                    fadeBg="#0f1115"
                    >${ticket.outcome}</bees-truncated-text
                  >
                </div>
              </div>
            `
          : nothing}
        ${ticket.error
          ? html`
              <div class="block error">
                <div class="block-header">Error</div>
                <div class="block-content">${ticket.error}</div>
              </div>
            `
          : nothing}
        ${ticket.runner === "live"
          ? this.renderLiveSessionPanel(ticket.id)
          : nothing}
        ${ticket.status === "suspended" && ticket.suspend_event
          ? this.renderSuspendedBlock(ticket.suspend_event)
          : nothing}
        ${ticket.tags && ticket.tags.length > 0
          ? html`
              <div class="block">
                <div class="block-header">Tags</div>
                <div class="block-content">
                  ${ticket.tags.map(
                    (tag) =>
                      html`<span class="tool-badge" style="margin-right:6px"
                        >${tag}</span
                      >`
                  )}
                </div>
              </div>
            `
          : nothing}
        ${ticket.functions && ticket.functions.length > 0
          ? html`
              <div class="block">
                <div class="block-header">Functions</div>
                <div class="block-content">
                  ${ticket.functions.map(
                    (fn) =>
                      html`<span class="tool-badge" style="margin-right:6px"
                        >${fn}</span
                      >`
                  )}
                </div>
              </div>
            `
          : nothing}
        ${ticket.watch_events && ticket.watch_events.length > 0
          ? html`
              <div class="block">
                <div class="block-header">Listening For</div>
                <div class="block-content">
                  ${ticket.watch_events.map(
                    (ev) =>
                      html`<span
                        class="signal-chip"
                        style="margin-right:6px"
                        >${ev.type}</span
                      >`
                  )}
                </div>
              </div>
            `
          : nothing}
        ${this.renderFileTree(ticket.id)}
      </div>
    `;
  }

  // --- File Tree ---

  private renderFileTree(ticketId: string) {
    const tree = this.fileTree;
    if (tree.length === 0) {
      this.loadFileTree(ticketId);
      return nothing;
    }

    return html`
      <div class="block">
        <div class="block-header">Files</div>
        <div class="file-tree">
          ${tree.map((node) => this.renderFileNode(node, ticketId, []))}
        </div>
      </div>
    `;
  }

  private renderFileNode(
    node: FileTreeNode,
    ticketId: string,
    parentPath: string[]
  ): unknown {
    const currentPath = [...parentPath, node.name];

    if (node.kind === "directory") {
      return html`
        <details class="file-dir">
          <summary>📁 ${node.name}</summary>
          <div class="file-children">
            ${node.children?.map((child) =>
              this.renderFileNode(child, ticketId, currentPath)
            )}
          </div>
        </details>
      `;
    }

    const pathKey = currentPath.join("/");
    const icon = this.fileIcon(node.name);
    const cachedContent = this.fileContents[pathKey];

    return html`
      <details
        class="file-leaf"
        @toggle=${(e: Event) => {
          const det = e.currentTarget as HTMLDetailsElement;
          if (det.open && cachedContent === undefined) {
            this.loadFileContent(ticketId, currentPath, pathKey);
          }
        }}
      >
        <summary>${icon} ${node.name}</summary>
        <div class="file-content">
          ${cachedContent === undefined
            ? html`<div style="color:#64748b;font-size:0.75rem">Loading…</div>`
            : cachedContent === null
              ? html`<div style="color:#64748b;font-size:0.75rem">
                  Unable to read file
                </div>`
              : this.renderFileContent(node.name, cachedContent)}
        </div>
      </details>
    `;
  }

  private renderFileContent(filename: string, content: string): unknown {
    if (filename.endsWith(".json")) {
      try {
        const parsed = JSON.parse(content);
        return html`<div class="json-tree">${renderJson(parsed)}</div>`;
      } catch {
        // Fall through to plain text.
      }
    }
    return html`<pre class="file-text">${content}</pre>`;
  }

  private fileIcon(name: string): string {
    if (name.endsWith(".json")) return "📊";
    if (name.endsWith(".md")) return "📝";
    if (name.endsWith(".py")) return "🐍";
    if (name.endsWith(".ts") || name.endsWith(".js")) return "📜";
    if (name.endsWith(".jsx") || name.endsWith(".tsx")) return "⚛️";
    if (name.endsWith(".css")) return "🎨";
    if (name.endsWith(".html")) return "🌐";
    if (name.endsWith(".mjs")) return "📦";
    return "📄";
  }

  private async loadFileTree(ticketId: string) {
    if (!this.ticketStore) return;
    const tree = await this.ticketStore.readTree(ticketId);
    this.fileTree = tree;
  }

  private async loadFileContent(
    ticketId: string,
    path: string[],
    pathKey: string
  ) {
    if (!this.ticketStore) return;
    const content = await this.ticketStore.readFileContent(ticketId, path);
    this.fileContents = {
      ...this.fileContents,
      [pathKey]: content,
    };
  }

  // ── Suspend ──

  /**
   * Render the suspended block — raw JSON tree for non-interactive
   * suspensions. User-facing interactive input (chat) is handled by
   * `<bees-chat-panel>` in the surface pane.
   */
  private renderSuspendedBlock(
    suspendEvent: Record<string, unknown>
  ) {
    const functionName = suspendEvent.function_name as string | undefined;
    const label =
      functionName === "chat_await_context_update"
        ? "Waiting for Event"
        : "Suspended";
    return html`
      <div class="block">
        <div class="block-header">${label}</div>
        <div class="block-content">
          <div class="json-tree">
            ${renderJson(suspendEvent)}
          </div>
        </div>
      </div>
    `;
  }

  // ── Live session ──

  private renderLiveSessionPanel(ticketId: string) {
    const hasActive = this.ticketStore?.activeLiveSessions
      .get()
      .has(ticketId);

    const client = this.ticketStore?.activeConnection.get();
    const isThisTicket = client?.taskId === ticketId;
    const status = isThisTicket ? (client!.status.get()) : "idle";
    const transcript = isThisTicket ? (client!.transcript.get()) : "";
    const isTalking = isThisTicket ? (client!.talking.get()) : false;

    if (!hasActive && status === "idle") return nothing;

    const isConnected =
      status === "connected" || status === "connecting";

    // Another ticket is currently connected.
    const otherConnected = client && !isThisTicket;

    return html`
      <div class="block live-panel">
        <div class="live-panel-header">
          <span class="live-status-dot ${status}"></span>
          <span class="live-status-label">Live Session — ${status}</span>
          ${isThisTicket && isConnected
            ? html`<button
                class="live-btn disconnect"
                @click=${() => this.handleLiveDisconnect()}
              >
                Disconnect
              </button>`
            : nothing}
        </div>
        ${hasActive
          ? html`<div class="live-mic-bar">
              <button
                class="live-btn talk ${isTalking ? "active" : ""}"
                @pointerdown=${() => this.handleTalkStart(ticketId)}
                @pointerup=${() => this.handleTalkEnd()}
                @pointerleave=${() => this.handleTalkEnd()}
              >
                ${otherConnected
                  ? "🎤 Talk to switch"
                  : isTalking
                    ? "🔊 Talking…"
                    : "🎤 Talk"}
              </button>
            </div>`
          : nothing}
        ${transcript
          ? html`<div class="live-transcript">${transcript}</div>`
          : isConnected
            ? html`<div class="live-transcript">
                <span class="live-transcript-empty"
                  >Waiting for agent response…</span
                >
              </div>`
            : nothing}
      </div>
    `;
  }

  /**
   * Handle Talk button press.
   *
   * First press connects (if not already connected to this ticket),
   * then opens the audio gate.
   */
  private async handleTalkStart(ticketId: string): Promise<void> {
    if (!this.ticketStore) return;

    const client = this.ticketStore.activeConnection.get();

    // Not connected to this ticket — connect first.
    if (!client || client.taskId !== ticketId) {
      await this.ticketStore.connectLiveSession(ticketId);
    }

    // Now begin talking (opens the audio gate).
    const activeClient = this.ticketStore.activeConnection.get();
    if (activeClient?.status.get() === "connected") {
      try {
        await activeClient.beginTalking();
      } catch (e) {
        console.error("Failed to start talking:", e);
      }
    }
  }

  /** Handle Talk button release — close the audio gate. */
  private handleTalkEnd(): void {
    const client = this.ticketStore?.activeConnection.get();
    if (client?.talking.get()) {
      client.endTalking();
    }
  }

  private handleLiveDisconnect(): void {
    this.ticketStore?.disconnectLiveSession();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-ticket-detail": BeesTicketDetail;
  }
}
