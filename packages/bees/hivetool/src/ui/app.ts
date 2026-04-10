/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import { APP_ICON, APP_NAME } from "../constants.js";
import { LogStore } from "../data/log-store.js";
import { parseRoute, writeRoute } from "../data/router.js";
import { StateAccess } from "../data/state-access.js";
import type { FileTreeNode } from "../data/ticket-store.js";
import { TicketStore } from "../data/ticket-store.js";
import { getRelativeTime } from "../utils.js";
import { styles } from "./app.styles.js";
import { renderJson } from "./json-tree.js";
import { jsonTreeStyles } from "./json-tree.styles.js";
import "./log-detail.js";
import "./truncated-text.js";

export { BeesApp };

type TabId = "logs" | "tickets" | "events";

@customElement("bees-app")
class BeesApp extends SignalWatcher(LitElement) {
  @state() accessor activeTab: TabId = "tickets";
  @state() accessor selectedEventId: string | null = null;
  @state() accessor ticketFileTree: FileTreeNode[] = [];
  @state() accessor ticketFileContents: Record<string, string | null> = {};

  private stateAccess = new StateAccess();
  private logStore = new LogStore(this.stateAccess);
  private ticketStore = new TicketStore(this.stateAccess);
  private currentFlashTicketId: string | null = null;
  private currentFlashLogId: string | null = null;

  static styles = [styles, jsonTreeStyles];

  connectedCallback() {
    super.connectedCallback();
    this.initStores();
    this.restoreRoute();
    window.addEventListener("hashchange", this.onHashChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.logStore.destroy();
    this.ticketStore.destroy();
    window.removeEventListener("hashchange", this.onHashChange);
  }

  // --- Store Initialization ---

  /** Initialize the state directory and activate both stores. */
  private async initStores(): Promise<void> {
    await this.stateAccess.init();
    if (this.stateAccess.accessState.get() !== "ready") return;
    await this.activateStores();
  }

  private async activateStores(): Promise<void> {
    await Promise.all([this.logStore.activate(), this.ticketStore.activate()]);
  }

  private async handleOpenDirectory(): Promise<void> {
    await this.stateAccess.openDirectory();
    if (this.stateAccess.accessState.get() === "ready") {
      await this.activateStores();
      this.restoreRoute();
    }
  }

  private async handleRequestAccess(): Promise<void> {
    await this.stateAccess.requestAccess();
    if (this.stateAccess.accessState.get() === "ready") {
      await this.activateStores();
      this.restoreRoute();
    }
  }

  private async handleSwitchHive(): Promise<void> {
    this.logStore.reset();
    this.ticketStore.reset();
    this.ticketFileTree = [];
    this.ticketFileContents = {};
    this.selectedEventId = null;
    await this.stateAccess.openDirectory();
    if (this.stateAccess.accessState.get() === "ready") {
      await this.activateStores();
      this.restoreRoute();
    }
  }

  // --- Routing ---

  /** Write current tab + selection to the URL hash. */
  private syncHash(): void {
    let id: string | null | undefined;
    switch (this.activeTab) {
      case "logs":
        id = this.logStore.selectedSessionId.get();
        break;
      case "tickets":
        id = this.ticketStore.selectedTicketId.get();
        break;
      case "events":
        id = this.selectedEventId;
        break;
    }
    writeRoute(this.activeTab, id);
  }

  /** Restore tab and selection from the URL hash on load. */
  private async restoreRoute(): Promise<void> {
    const route = parseRoute();
    const validTabs: TabId[] = ["logs", "tickets", "events"];
    const tab = validTabs.includes(route.tab as TabId)
      ? (route.tab as TabId)
      : "tickets";
    this.activeTab = tab;

    if (this.stateAccess.accessState.get() !== "ready") return;

    switch (tab) {
      case "logs":
        if (route.id) this.logStore.selectSession(route.id);
        break;
      case "tickets":
        if (route.id) {
          this.ticketFileTree = [];
          this.ticketFileContents = {};
          this.ticketStore.selectTicket(route.id);
        }
        break;
      case "events":
        if (route.id) this.selectedEventId = route.id;
        break;
    }
  }

  private onHashChange = () => this.restoreRoute();

  // --- Render ---

  render() {
    const access = this.stateAccess.accessState.get();
    const recentUpdate = this.ticketStore.recentlyUpdatedTicket.get();
    this.currentFlashTicketId = (recentUpdate && (Date.now() - recentUpdate.at < 15000)) ? recentUpdate.id : null;
    
    const recentLogUpdate = this.logStore.recentlyUpdatedSession.get();
    this.currentFlashLogId = (recentLogUpdate && (Date.now() - recentLogUpdate.at < 15000)) ? recentLogUpdate.id : null;

    if (access !== "ready") {
      return html`
        <div class="top-bar">
          <div class="top-bar-header">
            <h1>${APP_ICON} ${APP_NAME} Hivetool</h1>
          </div>
        </div>
        <div
          style="display:flex;align-items:center;justify-content:center;height:calc(100vh - 48px);flex-direction:column;gap:12px"
        >
          ${access === "none"
            ? html`
                <button @click=${() => this.handleOpenDirectory()}>
                  📂 Open Hive Directory
                </button>
                <div style="font-size:0.75rem;color:#64748b">
                  Select the <code>packages/bees/hive</code> directory
                </div>
              `
            : html`
                <button @click=${() => this.handleRequestAccess()}>
                  🔑 Grant Access
                </button>
                <div style="font-size:0.75rem;color:#64748b">
                  Permission expired — click to re-authorize
                </div>
              `}
        </div>
      `;
    }

    return html`
      <div class="top-bar">
        <div class="top-bar-header">
          <h1>${APP_ICON} ${APP_NAME} Hivetool</h1>
          <div class="hive-switcher">
            <span class="hive-name" title="Current hive directory">
              📂 ${this.stateAccess.hiveName.get() ?? ""}
            </span>
            <button
              class="switch-hive-btn"
              @click=${() => this.handleSwitchHive()}
            >
              Switch Hive
            </button>
          </div>
        </div>
        <div class="top-bar-tabs">
          <div
            class="sidebar-tab ${this.activeTab === "tickets" ? "active" : ""} ${this.currentFlashTicketId ? "lightning-flash" : ""}"
            @click=${() => {
              this.activeTab = "tickets";
              this.syncHash();
            }}
          >
            Tickets
          </div>
          <div
            class="sidebar-tab ${this.activeTab === "events" ? "active" : ""}"
            @click=${() => {
              this.activeTab = "events";
              this.syncHash();
            }}
          >
            Events
          </div>
          <div
            class="sidebar-tab ${this.activeTab === "logs" ? "active" : ""} ${this.currentFlashLogId ? "lightning-flash" : ""}"
            @click=${() => {
              this.activeTab = "logs";
              this.syncHash();
            }}
          >
            Sessions
          </div>
        </div>
      </div>

      <div class="content-row">
        <div class="sidebar">
          ${this.activeTab === "tickets"
            ? this.renderTicketsList()
            : this.activeTab === "events"
              ? this.renderEventsList()
              : this.renderLogsList()}
        </div>

        <div class="main">
          ${this.activeTab === "tickets"
            ? this.renderTicketDetail()
            : this.activeTab === "events"
              ? this.renderEventDetail()
              : this.renderLogDetail()}
        </div>
      </div>
    `;
  }

  private renderEmptyMain(text: string) {
    return html`<div class="empty-state">${text}</div>`;
  }

  // --- Logs ---

  /** Navigate to a specific log session by switching to the Logs tab. */
  private navigateToLog(sessionId: string) {
    this.activeTab = "logs";
    this.logStore.selectSession(sessionId);
    this.syncHash();
  }

  private renderLogsList() {
    const sessions = this.logStore.sessions.get();
    const selectedSid = this.logStore.selectedSessionId.get();

    if (sessions.length === 0) {
      return html`<div class="empty-state">No log files found.</div>`;
    }

    return html`
      <div class="jobs-list">
        ${sessions.map(
          (session) => html`
            <div class="job-item-group">
              <div
                class="job-item ${selectedSid === session.sessionId
                  ? "selected"
                  : ""} ${this.currentFlashLogId === session.sessionId ? "lightning-flash" : ""}"
                @click=${() => {
                  this.logStore.selectSession(session.sessionId);
                  this.syncHash();
                }}
              >
                <div class="job-header">
                  <div class="job-title mono">
                    ${session.sessionId.slice(0, 8)}
                  </div>
                  <div class="job-meta" style="margin:0">
                    <span>
                      ${session.files.length}
                      run${session.files.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div class="job-meta">
                  <span>
                    ${getRelativeTime(session.files.at(0)?.startedDateTime)}
                  </span>
                  <span>
                    ${(
                      session.files.reduce((s, f) => s + f.totalTokens, 0) /
                      1000
                    ).toFixed(1)}k
                    tokens
                  </span>
                </div>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  private renderLogDetail() {
    const data = this.logStore.selectedView.get();
    return html`<bees-log-detail
      .data=${data}
      @navigate=${(e: CustomEvent) => {
        const { tab, id } = e.detail;
        if (tab === "ticket") this.navigateToTicket(id);
      }}
    ></bees-log-detail>`;
  }

  // --- Tickets ---

  /** Navigate to a specific ticket by switching to the Tickets tab. */
  private navigateToTicket(ticketId: string) {
    this.ticketFileTree = [];
    this.ticketFileContents = {};
    this.activeTab = "tickets";
    this.ticketStore.selectTicket(ticketId);
    this.syncHash();
  }

  private renderTicketsList() {
    const allTickets = this.ticketStore.tickets.get();
    const tickets = allTickets.filter((t) => t.kind !== "coordination");
    const selectedId = this.ticketStore.selectedTicketId.get();

    if (tickets.length === 0) {
      return html`<div class="empty-state">No tickets found.</div>`;
    }

    return html`
      <div class="jobs-list">
        ${tickets.map(
          (t) => html`
            <div
              class="job-item ${selectedId === t.id ? "selected" : ""} ${this.currentFlashTicketId === t.id ? "lightning-flash" : ""}"
              @click=${() => {
                this.ticketFileTree = [];
                this.ticketFileContents = {};
                this.ticketStore.selectTicket(t.id);
                this.syncHash();
              }}
            >
              <div class="job-header">
                <div class="job-title">${t.title || t.id.slice(0, 8)}</div>
                <div class="job-status ${t.status}"></div>
              </div>
              <div class="job-meta">
                <span>${t.playbook_id ?? "ad-hoc"}</span>
                <span>${getRelativeTime(t.created_at)}</span>
              </div>
              ${t.tags && t.tags.length > 0
                ? html`
                    <div class="job-meta">
                      ${t.tags.map(
                        (tag) =>
                          html`<span
                            class="tool-badge"
                            style="font-size:0.65rem;padding:1px 5px"
                            >${tag}</span
                          >`
                      )}
                    </div>
                  `
                : nothing}
            </div>
          `
        )}
      </div>
    `;
  }

  private renderTicketDetail() {
    const ticket = this.ticketStore.selectedTicket.get();
    if (!ticket) return this.renderEmptyMain("Select a ticket to view details");

    const statusLabel =
      ticket.status === "suspended" && ticket.assignee === "user"
        ? "waiting for user"
        : ticket.status === "suspended"
          ? "waiting for signal"
          : ticket.status;

    // Collect identity chips.
    const identityChips: Array<{
      label: string;
      value: string;
      cls?: string;
      onclick?: () => void;
    }> = [];
    if (ticket.model)
      identityChips.push({ label: "model", value: ticket.model, cls: "model" });
    if (ticket.playbook_id)
      identityChips.push({
        label: "playbook",
        value: ticket.playbook_id,
        cls: "playbook",
      });
    if (ticket.parent_ticket_id)
      identityChips.push({
        label: "parent",
        value: ticket.parent_ticket_id.slice(0, 8),
        onclick: () => this.navigateToTicket(ticket.parent_ticket_id!),
      });
    identityChips.push({
      label: "session",
      value: ticket.id.slice(0, 8),
      onclick: () => this.navigateToLog(ticket.id),
    });
    if (ticket.skills && ticket.skills.length > 0)
      for (const s of ticket.skills)
        identityChips.push({ label: "skill", value: s, cls: "skill" });

    const chatHistory = (ticket.chat_history ?? []).filter(
      (m) => m.text.trim() !== ""
    );

    return html`
      <div class="job-detail ${this.currentFlashTicketId === ticket.id ? "lightning-flash" : ""}">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${ticket.title || "Ticket"}</h2>
            <div class="job-detail-badge ${ticket.status}">${statusLabel}</div>
          </div>
          <div class="job-detail-meta">
            <span
              >ID: <code class="mono">${ticket.id.slice(0, 13)}...</code></span
            >
            <span
              >Created:
              ${new Date(ticket.created_at ?? "").toLocaleString()}</span
            >
            ${ticket.completed_at
              ? html`<span
                  >Completed:
                  ${new Date(ticket.completed_at).toLocaleString()}</span
                >`
              : nothing}
            ${ticket.turns ? html`<span>${ticket.turns} turns</span>` : nothing}
            ${ticket.thoughts
              ? html`<span>${ticket.thoughts} thoughts</span>`
              : nothing}
          </div>
        </div>

        <div class="timeline">
          ${identityChips.length > 0
            ? html`
                <div class="identity-row">
                  ${identityChips.map(
                    (c) => html`
                      <span
                        class="identity-chip ${c.cls ?? ""} ${c.onclick
                          ? "linkable"
                          : ""}"
                        @click=${c.onclick ?? nothing}
                      >
                        <span class="identity-label">${c.label}</span>
                        ${c.value}
                      </span>
                    `
                  )}
                  ${ticket.playbook_run_id
                    ? html`<span class="identity-chip">
                        <span class="identity-label">run</span>
                        ${ticket.playbook_run_id.slice(0, 8)}
                      </span>`
                    : nothing}
                </div>
              `
            : nothing}
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
          ${chatHistory.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">
                    Chat (${chatHistory.length} messages)
                  </div>
                  <div class="chat-log">
                    ${chatHistory.map(
                      (m) => html`
                        <div
                          class="chat-turn ${m.role === "user"
                            ? "user"
                            : "agent"}"
                        >
                          <div class="chat-role">${m.role}</div>
                          <div class="chat-text">${m.text}</div>
                        </div>
                      `
                    )}
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
          ${ticket.status === "suspended" && ticket.suspend_event
            ? html`
                <div class="block">
                  <div class="block-header">Suspended</div>
                  <div class="block-content">
                    <div class="json-tree">
                      ${renderJson(ticket.suspend_event)}
                    </div>
                  </div>
                </div>
              `
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
                        html`<span class="signal-chip" style="margin-right:6px"
                          >${ev.type}</span
                        >`
                    )}
                  </div>
                </div>
              `
            : nothing}
          ${this.renderFileTree(ticket.id)}
        </div>
      </div>
    `;
  }

  // --- Events ---

  private renderEventsList() {
    const allTickets = this.ticketStore.tickets.get();
    const events = allTickets.filter((t) => t.kind === "coordination");

    if (events.length === 0) {
      return html`<div class="empty-state">No events yet.</div>`;
    }

    return html`
      <div class="jobs-list">
        ${events.map(
          (t) => html`
            <div
              class="job-item ${this.selectedEventId === t.id
                ? "selected"
                : ""}"
              @click=${() => {
                this.selectedEventId = t.id;
                this.syncHash();
              }}
            >
              <div class="job-header">
                <div class="job-title">
                  <span class="signal-chip">${t.signal_type}</span>
                </div>
                <div class="job-status ${t.status}"></div>
              </div>
              <div class="job-meta">
                <span
                  style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px"
                  >${t.context ?? ""}</span
                >
                <span>${getRelativeTime(t.created_at)}</span>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  private renderEventDetail() {
    const allTickets = this.ticketStore.tickets.get();
    const event = allTickets.find(
      (t) => t.id === this.selectedEventId && t.kind === "coordination"
    );
    if (!event) return this.renderEmptyMain("Select an event to inspect");

    // Try to resolve delivered-to IDs to ticket titles.
    const resolveTitle = (id: string): string => {
      const t = allTickets.find((tk) => tk.id === id);
      return t?.title ?? id.slice(0, 8);
    };

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">
              <span class="signal-chip">${event.signal_type}</span>
            </h2>
          </div>
          <div class="job-detail-meta">
            <span
              >ID: <code class="mono">${event.id.slice(0, 13)}...</code></span
            >
            <span>${new Date(event.created_at ?? "").toLocaleString()}</span>
          </div>
        </div>

        <div class="timeline">
          ${event.context
            ? html`
                <div class="context-card">
                  <div class="context-label">Signal Context</div>
                  <bees-truncated-text
                    threshold="300"
                    max-height="150"
                    fadeBg="#111827"
                    >${event.context}</bees-truncated-text
                  >
                </div>
              `
            : nothing}
          ${event.delivered_to && event.delivered_to.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Delivered To</div>
                  <div class="block-content">
                    <div class="delivered-to">
                      ${event.delivered_to.map(
                        (id) => html`
                          <span class="delivered-to-id"
                            >${resolveTitle(id)}</span
                          >
                        `
                      )}
                    </div>
                  </div>
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  // --- File Tree ---

  /** Load and render the file tree for a ticket. */
  private renderFileTree(ticketId: string) {
    const tree = this.ticketFileTree;
    if (tree.length === 0) {
      // Trigger async load on first render.
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
    const cachedContent = this.ticketFileContents[pathKey];

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
    const tree = await this.ticketStore.readTree(ticketId);
    this.ticketFileTree = tree;
  }

  private async loadFileContent(
    ticketId: string,
    path: string[],
    pathKey: string
  ) {
    const content = await this.ticketStore.readFileContent(ticketId, path);
    this.ticketFileContents = {
      ...this.ticketFileContents,
      [pathKey]: content,
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-app": BeesApp;
  }
}
