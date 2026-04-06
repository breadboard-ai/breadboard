/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";

import { sca } from "../sca/sca.js";
import type { TicketData, PlaybookData } from "../data/types.js";
import { getRelativeTime, extractPrompt } from "../utils.js";
import { APP_NAME, APP_ICON } from "../constants.js";
import { styles } from "./app.styles.js";
import { jsonTreeStyles } from "./json-tree.styles.js";
import { renderJson } from "./json-tree.js";
import { StateAccess } from "../data/state-access.js";
import { parseRoute, writeRoute } from "../data/router.js";
import { LogStore } from "../data/log-store.js";
import { TicketStore } from "../data/ticket-store.js";
import type { FileTreeNode } from "../data/ticket-store.js";
import "./log-detail.js";
import "./truncated-text.js";

export { BeesApp };

/** Tags that identify long-running daemon agents. */
const DAEMON_TAGS = ["opie", "journey", "digest"];

interface JobGroup {
  id: string;
  title: string;
  tickets: TicketData[];
  createdAt: string;
  status: "running" | "completed" | "failed" | "suspended" | "pending";
}

interface DaemonInfo {
  ticket: TicketData;
  label: string;
  daemonTag: string;
}

type TabId = "jobs" | "playbooks" | "daemons" | "logs" | "tickets" | "events";

@customElement("bees-app")
class BeesApp extends SignalWatcher(LitElement) {
  @state() accessor activeTab: TabId = "jobs";
  @state() accessor selectedJobId: string | null = null;
  @state() accessor playbooks: PlaybookData[] = [];
  @state() accessor loadingPlaybooks = false;
  @state() accessor selectedDaemonId: string | null = null;
  @state() accessor selectedEventId: string | null = null;
  @state() accessor ticketFileTree: FileTreeNode[] = [];
  @state() accessor ticketFileContents: Record<string, string | null> = {};

  private stateAccess = new StateAccess();
  private stateAccessInitialized = false;
  private logStore = new LogStore(this.stateAccess);
  private ticketStore = new TicketStore(this.stateAccess);

  private get scaInst() {
    return sca();
  }

  private get sse() {
    return this.scaInst.services.sse;
  }

  private get api() {
    return this.scaInst.services.api;
  }

  static styles = [styles, jsonTreeStyles];

  connectedCallback() {
    super.connectedCallback();
    this.sse.connect();
    this.loadPlaybooks();
    this.restoreRoute();
    window.addEventListener("hashchange", this.onHashChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.sse.close();
    this.logStore.destroy();
    this.ticketStore.destroy();
    window.removeEventListener("hashchange", this.onHashChange);
  }

  private deriveJobs(): JobGroup[] {
    const tickets = this.scaInst.controller.global.tickets;
    const map = new Map<string, TicketData[]>();
    const coordinationTickets: TicketData[] = [];

    for (const t of tickets) {
      if (t.kind === "coordination") {
        coordinationTickets.push(t);
        continue;
      }
      const jobId = t.playbook_run_id || t.id;
      const list = map.get(jobId) || [];
      list.push(t);
      map.set(jobId, list);
    }

    const jobs: JobGroup[] = [];
    for (const [id, group] of map) {
      group.sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? "")
      );

      const first = group[0];

      let status: JobGroup["status"] = "pending";
      if (group.some((t) => t.status === "running")) {
        status = "running";
      } else if (
        group.some((t) => t.status === "suspended" && t.assignee === "user")
      ) {
        status = "suspended";
      } else if (group.some((t) => t.status === "failed")) {
        status = "failed";
      } else if (group.every((t) => t.status === "completed")) {
        status = "completed";
      }

      let title = first.playbook_run_id
        ? `Run: ${first.playbook_run_id.slice(0, 8)}`
        : first.title || "Ad-hoc Ticket";
      if (first.tags?.includes("opie")) title = "Opie Coordinator";

      jobs.push({
        id,
        title,
        tickets: group,
        createdAt: first.created_at || new Date().toISOString(),
        status,
      });
    }

    // Group all coordination tickets into a single "Event Bus" entry.
    if (coordinationTickets.length > 0) {
      coordinationTickets.sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? "")
      );

      let busStatus: JobGroup["status"] = "completed";
      if (coordinationTickets.some((t) => t.status === "available")) {
        busStatus = "running";
      } else if (coordinationTickets.some((t) => t.status === "failed")) {
        busStatus = "failed";
      }

      jobs.push({
        id: "__event_bus__",
        title: "Event Bus",
        tickets: coordinationTickets,
        createdAt:
          coordinationTickets[0].created_at || new Date().toISOString(),
        status: busStatus,
      });
    }

    jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return jobs;
  }

  private deriveDaemons(): DaemonInfo[] {
    const tickets = this.scaInst.controller.global.tickets;
    const daemons: DaemonInfo[] = [];

    for (const t of tickets) {
      if (t.kind === "coordination") continue;
      const tags = t.tags ?? [];
      const matchedTag = tags.find((tag) => DAEMON_TAGS.includes(tag));
      if (!matchedTag) continue;

      let label = t.title || "Daemon";
      if (matchedTag === "opie") label = `☕ ${label}`;
      else if (matchedTag === "journey") label = `🧭 ${label}`;
      else if (matchedTag === "digest") label = `📰 ${label}`;

      daemons.push({ ticket: t, label, daemonTag: matchedTag });
    }

    // Active daemons first, then by creation time.
    daemons.sort((a, b) => {
      const aActive =
        a.ticket.status !== "completed" && a.ticket.status !== "failed";
      const bActive =
        b.ticket.status !== "completed" && b.ticket.status !== "failed";
      if (aActive !== bActive) return aActive ? -1 : 1;
      return (b.ticket.created_at ?? "").localeCompare(
        a.ticket.created_at ?? ""
      );
    });

    return daemons;
  }

  render() {
    const jobs = this.deriveJobs();
    const daemons = this.deriveDaemons();

    // Auto-select first job
    if (!this.selectedJobId && jobs.length > 0 && this.activeTab === "jobs") {
      this.selectedJobId = jobs[0].id;
    }
    if (
      !this.selectedDaemonId &&
      daemons.length > 0 &&
      this.activeTab === "daemons"
    ) {
      this.selectedDaemonId = daemons[0].ticket.id;
    }

    return html`
      <div class="top-bar">
        <div class="top-bar-header">
          <h1>${APP_ICON} ${APP_NAME} DevTools</h1>
        </div>
        <div class="top-bar-tabs">
          <div
            class="sidebar-tab ${this.activeTab === "jobs" ? "active" : ""}"
            @click=${() => { this.activeTab = "jobs"; this.syncHash(); }}
          >
            Jobs
          </div>
          <div
            class="sidebar-tab ${this.activeTab === "daemons" ? "active" : ""}"
            @click=${() => { this.activeTab = "daemons"; this.syncHash(); }}
          >
            Daemons
            ${daemons.filter(
              (d) =>
                d.ticket.status !== "completed" && d.ticket.status !== "failed"
            ).length > 0
              ? html`<span class="daemon-count"
                  >${daemons.filter(
                    (d) =>
                      d.ticket.status !== "completed" &&
                      d.ticket.status !== "failed"
                  ).length}</span
                >`
              : nothing}
          </div>
          <div
            class="sidebar-tab ${this.activeTab === "playbooks"
              ? "active"
              : ""}"
            @click=${() => { this.activeTab = "playbooks"; this.syncHash(); }}
          >
            Playbooks
          </div>
          <div
            class="sidebar-tab ${this.activeTab === "logs" ? "active" : ""}"
            @click=${() => this.activateLogsTab()}
          >
            Logs
          </div>
          <div
            class="sidebar-tab ${this.activeTab === "tickets" ? "active" : ""}"
            @click=${() => this.activateTicketsTab()}
          >
            Tickets
          </div>
          <div
            class="sidebar-tab ${this.activeTab === "events" ? "active" : ""}"
            @click=${() => this.activateEventsTab()}
          >
            Events
          </div>
        </div>
      </div>

      <div class="content-row">
        <div class="sidebar">
          ${this.activeTab === "jobs"
            ? this.renderJobsList(jobs)
            : this.activeTab === "daemons"
              ? this.renderDaemonsList(daemons)
              : this.activeTab === "logs"
                ? this.renderLogsList()
                : this.activeTab === "tickets"
                  ? this.renderTicketsList()
                  : this.activeTab === "events"
                    ? this.renderEventsList()
                    : this.renderPlaybooksList()}
        </div>

        <div class="main">
          ${this.activeTab === "jobs"
            ? this.renderJobDetail(jobs)
            : this.activeTab === "daemons"
              ? this.renderDaemonDetail(daemons)
              : this.activeTab === "logs"
                ? this.renderLogDetail()
                : this.activeTab === "tickets"
                  ? this.renderTicketDetail()
                  : this.activeTab === "events"
                    ? this.renderEventDetail()
                    : this.renderEmptyMain("Select a playbook to run on the left.")}
        </div>
      </div>
    `;
  }

  // --- State Access ---

  /** Initialize state directory access (IDB load, permission check). */
  private async ensureStateAccess(): Promise<void> {
    if (this.stateAccessInitialized) return;
    this.stateAccessInitialized = true;
    await this.stateAccess.init();
  }

  /** Shared access-gate UI for tabs that need the state directory. */
  private renderAccessGate() {
    const access = this.stateAccess.accessState.get();

    if (access === "none") {
      return html`
        <div class="jobs-list">
          <div
            style="padding:24px 16px;text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center"
          >
            <button @click=${() => this.handleOpenDirectory()}>
              📂 Open State Directory
            </button>
            <div style="font-size:0.75rem;color:#64748b">
              Select the <code>packages/bees/state</code> directory
            </div>
          </div>
        </div>
      `;
    }

    if (access === "prompt") {
      return html`
        <div class="jobs-list">
          <div
            style="padding:24px 16px;text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center"
          >
            <button @click=${() => this.handleRequestAccess()}>
              🔑 Grant Access
            </button>
            <div style="font-size:0.75rem;color:#64748b">
              Permission expired — click to re-authorize
            </div>
          </div>
        </div>
      `;
    }

    // Access is "ready" — no gate needed.
    return null;
  }

  private async handleOpenDirectory(): Promise<void> {
    await this.stateAccess.openDirectory();
    this.activateCurrentStore();
  }

  private async handleRequestAccess(): Promise<void> {
    await this.stateAccess.requestAccess();
    this.activateCurrentStore();
  }

  /** Activate the store and restore any pending selection from the URL. */
  private async activateCurrentStore(): Promise<void> {
    const { tab, id } = parseRoute();
    if (this.activeTab === "logs") {
      await this.logStore.activate();
      if (id) this.logStore.selectSession(id);
    }
    if (this.activeTab === "tickets" || this.activeTab === "events") {
      await this.ticketStore.activate();
      if (tab === "tickets" && id) {
        this.ticketFileTree = [];
        this.ticketFileContents = {};
        this.ticketStore.selectTicket(id);
      }
      if (tab === "events" && id) {
        this.selectedEventId = id;
      }
    }
  }

  // --- Routing ---

  /** Write current tab + selection to the URL hash. */
  private syncHash(): void {
    let id: string | null | undefined;
    switch (this.activeTab) {
      case "jobs": id = this.selectedJobId; break;
      case "daemons": id = this.selectedDaemonId; break;
      case "logs": id = this.logStore.selectedSessionId.get(); break;
      case "tickets": id = this.ticketStore.selectedTicketId.get(); break;
      case "events": id = this.selectedEventId; break;
    }
    writeRoute(this.activeTab, id);
  }

  /** Restore tab and selection from the URL hash on load. */
  private async restoreRoute(): Promise<void> {
    const route = parseRoute();
    if (route.tab === "jobs" && !route.id) return; // default state

    this.activeTab = route.tab;

    switch (route.tab) {
      case "logs":
        await this.ensureStateAccess();
        await this.logStore.activate();
        if (route.id) this.logStore.selectSession(route.id);
        break;
      case "tickets":
        await this.ensureStateAccess();
        await this.ticketStore.activate();
        if (route.id) {
          this.ticketFileTree = [];
          this.ticketFileContents = {};
          this.ticketStore.selectTicket(route.id);
        }
        break;
      case "events":
        await this.ensureStateAccess();
        await this.ticketStore.activate();
        if (route.id) this.selectedEventId = route.id;
        break;
      case "jobs":
        if (route.id) this.selectedJobId = route.id;
        break;
      case "daemons":
        if (route.id) this.selectedDaemonId = route.id;
        break;
    }
  }

  private onHashChange = () => this.restoreRoute();

  // --- Playbooks ---

  private async loadPlaybooks() {
    this.loadingPlaybooks = true;
    this.playbooks = await this.api.listPlaybooks();
    this.loadingPlaybooks = false;
  }

  private renderPlaybooksList() {
    if (this.loadingPlaybooks)
      return html`<div class="empty-state">Loading...</div>`;
    return html`
      <div class="jobs-list">
        <div style="padding: 12px; font-size: 0.8rem; color: #94a3b8;">
          Click a playbook to spawn a new run.
        </div>
        ${this.playbooks.map(
          (p) => html`
            <div
              class="job-item"
              @click=${() =>
                this.api
                  .runPlaybook(p.name)
                  .then(() => (this.activeTab = "jobs"))}
            >
              <div class="job-title">${p.title}</div>
              <div
                class="job-meta"
                style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
              >
                ${p.description}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  // --- Jobs List ---

  private renderJobsList(jobs: JobGroup[]) {
    if (jobs.length === 0)
      return html`<div class="empty-state">No jobs yet.</div>`;
    return html`
      <div class="jobs-list">
        ${jobs.map(
          (job) => html`
            <div
              class="job-item ${this.selectedJobId === job.id
                ? "selected"
                : ""}"
              @click=${() => { this.selectedJobId = job.id; this.syncHash(); }}
            >
              <div class="job-header">
                <div class="job-title">${job.title}</div>
                <div class="job-status ${job.status}"></div>
              </div>
              <div class="job-meta">
                <span
                  >${job.tickets.length}
                  step${job.tickets.length === 1 ? "" : "s"}</span
                >
                <span>${getRelativeTime(job.createdAt)}</span>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  // --- Daemons ---

  private renderDaemonsList(daemons: DaemonInfo[]) {
    if (daemons.length === 0)
      return html`<div class="empty-state">No daemons running.</div>`;
    return html`
      <div class="jobs-list">
        ${daemons.map(
          (d) => html`
            <div
              class="job-item ${this.selectedDaemonId === d.ticket.id
                ? "selected"
                : ""}"
              @click=${() => { this.selectedDaemonId = d.ticket.id; this.syncHash(); }}
            >
              <div class="job-header">
                <div class="job-title">${d.label}</div>
                <div class="job-status ${d.ticket.status}"></div>
              </div>
              <div class="job-meta">
                <span>${d.daemonTag}</span>
                <span>${getRelativeTime(d.ticket.created_at)}</span>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  private renderDaemonDetail(daemons: DaemonInfo[]) {
    const daemon = daemons.find((d) => d.ticket.id === this.selectedDaemonId);
    if (!daemon) return this.renderEmptyMain("Select a daemon to inspect");

    const t = daemon.ticket;
    const statusLabel =
      t.status === "suspended" && t.assignee === "user"
        ? "waiting for user"
        : t.status === "suspended"
          ? "waiting for signal"
          : t.status;

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${daemon.label}</h2>
            <div class="job-detail-badge ${t.status}">${statusLabel}</div>
          </div>
          <div class="job-detail-meta">
            <span>ID: <code class="mono">${t.id.slice(0, 13)}...</code></span>
            <span
              >Started: ${new Date(t.created_at ?? "").toLocaleString()}</span
            >
            ${t.turns ? html`<span>${t.turns} turns</span>` : nothing}
            ${t.thoughts ? html`<span>${t.thoughts} thoughts</span>` : nothing}
          </div>
        </div>

        <div class="timeline">
          ${t.tags && t.tags.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Tags</div>
                  <div class="block-content">
                    ${t.tags.map(
                      (tag) =>
                        html`<span class="tool-badge" style="margin-right:6px"
                          >${tag}</span
                        >`
                    )}
                  </div>
                </div>
              `
            : nothing}
          ${t.events_log?.length
            ? html`
                <div class="block">
                  <div class="block-header">Trace Log</div>
                  <div class="block-content trace-list mono">
                    ${t.events_log.map((e) => this.renderTraceEvent(e))}
                  </div>
                </div>
              `
            : nothing}
          ${t.outcome
            ? html`
                <div class="block">
                  <div class="block-header">Last Outcome</div>
                  <div class="block-content"><bees-truncated-text threshold="300" max-height="150" fadeBg="#0f1115">${t.outcome}</bees-truncated-text></div>
                </div>
              `
            : nothing}
          ${t.error
            ? html`
                <div class="block error">
                  <div class="block-header">Error</div>
                  <div class="block-content">${t.error}</div>
                </div>
              `
            : nothing}
          ${t.status === "suspended" && t.assignee === "user"
            ? this.renderRespond(t)
            : nothing}
        </div>
      </div>
    `;
  }

  private renderEmptyMain(text: string) {
    return html`<div class="empty-state">${text}</div>`;
  }

  // --- Job Detail ---

  private renderJobDetail(jobs: JobGroup[]) {
    const job = jobs.find((j) => j.id === this.selectedJobId);
    if (!job) return this.renderEmptyMain("Select a job to view details");

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${job.title}</h2>
            <div class="job-detail-badge ${job.status}">${job.status}</div>
          </div>
          <div class="job-detail-meta">
            ${job.id === "__event_bus__"
              ? html`<span
                  >${job.tickets.length}
                  event${job.tickets.length === 1 ? "" : "s"}</span
                >`
              : html`<span
                  >ID: <code class="mono">${job.id.slice(0, 13)}...</code></span
                >`}
            <span>Started: ${new Date(job.createdAt).toLocaleString()}</span>
          </div>
        </div>

        <div class="timeline">
          ${job.tickets.map((t) => this.renderStep(t))}
        </div>
      </div>
    `;
  }

  private renderStep(t: TicketData) {
    return html`
      <div class="step ${t.status}">
        <div class="step-node"></div>
        <div class="step-card">
          <div class="step-header">
            <div class="step-title">
              ${t.title || "Task"}
              <span class="step-id">${t.id.slice(0, 8)}</span>
            </div>
            <div class="step-time">${getRelativeTime(t.created_at)}</div>
          </div>
          <div class="step-body">
            ${t.kind === "coordination"
              ? html`
                  <div class="tool-row">
                    <span class="tool-badge">signal:${t.signal_type}</span>
                    ${t.context
                      ? html`<span style="font-size:0.85rem;color:#cbd5e1"
                          >${t.context}</span
                        >`
                      : nothing}
                  </div>
                  ${t.delivered_to && t.delivered_to.length > 0
                    ? html`
                        <div class="delivered-to">
                          <span class="delivered-to-label">Delivered to</span>
                          ${t.delivered_to.map(
                            (id) =>
                              html`<span class="delivered-to-id"
                                >${id.slice(0, 8)}</span
                              >`
                          )}
                        </div>
                      `
                    : nothing}
                `
              : html`
                  <div class="step-objective">${t.objective || t.context}</div>
                `}
            ${t.error
              ? html`
                  <div class="block error">
                    <div class="block-header">Error</div>
                    <div class="block-content">${t.error}</div>
                  </div>
                `
              : nothing}
            ${t.outcome
              ? html`
                  <div class="block">
                    <div class="block-header">Outcome</div>
                    <div class="block-content"><bees-truncated-text threshold="300" max-height="150" fadeBg="#0f1115">${t.outcome}</bees-truncated-text></div>
                  </div>
                `
              : nothing}
            ${t.events_log?.length
              ? html`
                  <div class="block">
                    <div class="block-header">Trace Log</div>
                    <div class="block-content trace-list mono">
                      ${t.events_log.map((e) => this.renderTraceEvent(e))}
                    </div>
                  </div>
                `
              : nothing}

            <div class="metrics">
              ${t.depends_on && t.depends_on.length > 0
                ? html`<span
                    >Deps:
                    ${t.depends_on.map((d) => d.slice(0, 8)).join(", ")}</span
                  >`
                : nothing}
              ${t.turns ? html`<span>${t.turns} turns</span>` : nothing}
              ${t.thoughts
                ? html`<span>${t.thoughts} thoughts</span>`
                : nothing}
              <span
                style="margin-left:auto;text-transform:uppercase;font-weight:600;color:${this.getStatusColor(
                  t.status
                )}"
                >${t.status}</span
              >
            </div>

            ${t.status === "suspended" && t.assignee === "user"
              ? this.renderRespond(t)
              : nothing}
          </div>
        </div>
      </div>
    `;
  }

  private getStatusColor(status: string) {
    switch (status) {
      case "running":
        return "#60a5fa";
      case "completed":
        return "#34d399";
      case "failed":
        return "#f87171";
      case "suspended":
        return "#fbbf24";
      default:
        return "#94a3b8";
    }
  }

  private renderTraceEvent(e: Record<string, unknown>) {
    if ("thought" in e) {
      const thought = e.thought as Record<string, unknown>;
      return html`<div class="trace-item thought">💭 ${thought.text}</div>`;
    }
    if ("functionCall" in e) {
      const fc = e.functionCall as Record<string, unknown>;
      return html`<div class="trace-item tool">🔧 ${fc.name}(...)</div>`;
    }
    if ("error" in e) {
      const err = e.error as Record<string, unknown>;
      return html`<div class="trace-item error">❌ ${err.message}</div>`;
    }
    return nothing;
  }

  // --- Respond Actions ---

  @state() accessor responses: Record<string, string> = {};

  private renderRespond(t: TicketData) {
    const prompt = extractPrompt(t);
    return html`
      <div class="action-bar">
        <input
          style="flex: 1"
          type="text"
          placeholder=${prompt || "Provide input..."}
          .value=${this.responses[t.id] ?? ""}
          @input=${(e: Event) =>
            (this.responses = {
              ...this.responses,
              [t.id]: (e.target as HTMLInputElement).value,
            })}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === "Enter") this.respond(t.id);
          }}
        />
        <button @click=${() => this.respond(t.id)}>Send</button>
      </div>
    `;
  }

  // --- Logs ---

  private async activateLogsTab() {
    this.activeTab = "logs";
    this.syncHash();
    await this.ensureStateAccess();
    this.logStore.activate();
  }

  /** Navigate to a specific log session by switching to the Logs tab. */
  private async navigateToLog(sessionId: string) {
    await this.activateLogsTab();
    this.logStore.selectSession(sessionId);
    this.syncHash();
  }

  private renderLogsList() {
    const gate = this.renderAccessGate();
    if (gate) return gate;

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
                  : ""}"
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
                    ${getRelativeTime(
                      session.files.at(0)?.startedDateTime
                    )}
                  </span>
                  <span>
                    ${(
                      session.files.reduce(
                        (s, f) => s + f.totalTokens,
                        0
                      ) / 1000
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

  private async activateTicketsTab() {
    this.activeTab = "tickets";
    this.syncHash();
    await this.ensureStateAccess();
    this.ticketStore.activate();
  }

  /** Navigate to a specific ticket by switching to the Tickets tab. */
  private async navigateToTicket(ticketId: string) {
    this.ticketFileTree = [];
    this.ticketFileContents = {};
    await this.activateTicketsTab();
    this.ticketStore.selectTicket(ticketId);
    this.syncHash();
  }

  // --- Events ---

  private async activateEventsTab() {
    this.activeTab = "events";
    this.syncHash();
    await this.ensureStateAccess();
    this.ticketStore.activate();
  }

  private renderEventsList() {
    const gate = this.renderAccessGate();
    if (gate) return gate;

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
              @click=${() => { this.selectedEventId = t.id; this.syncHash(); }}
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
              >ID:
              <code class="mono">${event.id.slice(0, 13)}...</code></span
            >
            <span
              >${new Date(event.created_at ?? "").toLocaleString()}</span
            >
          </div>
        </div>

        <div class="timeline">
          ${event.context
            ? html`
                <div class="context-card">
                  <div class="context-label">Signal Context</div>
                  <bees-truncated-text threshold="300" max-height="150" fadeBg="#111827">${event.context}</bees-truncated-text>
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

  private renderTicketsList() {
    const gate = this.renderAccessGate();
    if (gate) return gate;

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
              class="job-item ${selectedId === t.id ? "selected" : ""}"
              @click=${() => {
                this.ticketFileTree = [];
                this.ticketFileContents = {};
                this.ticketStore.selectTicket(t.id);
                this.syncHash();
              }}
            >
              <div class="job-header">
                <div class="job-title">
                  ${t.title || t.id.slice(0, 8)}
                </div>
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
    if (!ticket)
      return this.renderEmptyMain("Select a ticket to view details");

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
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${ticket.title || "Ticket"}</h2>
            <div class="job-detail-badge ${ticket.status}">${statusLabel}</div>
          </div>
          <div class="job-detail-meta">
            <span
              >ID:
              <code class="mono">${ticket.id.slice(0, 13)}...</code></span
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
            ${ticket.turns
              ? html`<span>${ticket.turns} turns</span>`
              : nothing}
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
                        class="identity-chip ${c.cls ?? ""} ${c.onclick ? "linkable" : ""}"
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
                  <bees-truncated-text threshold="300" max-height="150" fadeBg="#111827">${ticket.context}</bees-truncated-text>
                </div>
              `
            : nothing}
          ${ticket.objective &&
          ticket.objective.trim() !== (ticket.context ?? "").trim()
            ? html`
                <div class="block">
                  <div class="block-header">Objective</div>
                  <div class="block-content">
                    <bees-truncated-text threshold="500" max-height="200" fadeBg="#0f1115">${ticket.objective}</bees-truncated-text>
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
                          class="chat-turn ${
                            m.role === "user" ? "user" : "agent"
                          }"
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
                    <bees-truncated-text threshold="300" max-height="150" fadeBg="#0f1115">${ticket.outcome}</bees-truncated-text>
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
      </div>
    `;
  }

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
        <div class="file-tree">${tree.map((node) => this.renderFileNode(node, ticketId, []))}</div>
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

  private async respond(ticketId: string) {
    const text = this.responses[ticketId]?.trim();
    if (!text) return;

    this.responses = { ...this.responses, [ticketId]: "" };
    await this.api.respond(ticketId, text);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-app": BeesApp;
  }
}
