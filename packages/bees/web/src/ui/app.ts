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
import { LogStore } from "../data/log-store.js";
import "./log-detail.js";

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

@customElement("bees-app")
class BeesApp extends SignalWatcher(LitElement) {
  @state() accessor activeTab: "jobs" | "playbooks" | "daemons" | "logs" =
    "jobs";
  @state() accessor selectedJobId: string | null = null;
  @state() accessor playbooks: PlaybookData[] = [];
  @state() accessor loadingPlaybooks = false;
  @state() accessor selectedDaemonId: string | null = null;

  private logStore = new LogStore();
  private logStoreInitialized = false;

  private get scaInst() {
    return sca();
  }

  private get sse() {
    return this.scaInst.services.sse;
  }

  private get api() {
    return this.scaInst.services.api;
  }

  static styles = [styles];

  connectedCallback() {
    super.connectedCallback();
    this.sse.connect();
    this.loadPlaybooks();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.sse.close();
    this.logStore.destroy();
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
      <div class="sidebar">
        <div class="sidebar-header">
          <h1>${APP_ICON} ${APP_NAME} DevTools</h1>
        </div>
        <div class="sidebar-tabs">
          <div
            class="sidebar-tab ${this.activeTab === "jobs" ? "active" : ""}"
            @click=${() => (this.activeTab = "jobs")}
          >
            Jobs
          </div>
          <div
            class="sidebar-tab ${this.activeTab === "daemons" ? "active" : ""}"
            @click=${() => (this.activeTab = "daemons")}
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
            @click=${() => (this.activeTab = "playbooks")}
          >
            Playbooks
          </div>
          <div
            class="sidebar-tab ${this.activeTab === "logs" ? "active" : ""}"
            @click=${() => this.activateLogsTab()}
          >
            Logs
          </div>
        </div>

        ${this.activeTab === "jobs"
          ? this.renderJobsList(jobs)
          : this.activeTab === "daemons"
            ? this.renderDaemonsList(daemons)
            : this.activeTab === "logs"
              ? this.renderLogsList()
              : this.renderPlaybooksList()}
      </div>

      <div class="main">
        ${this.activeTab === "jobs"
          ? this.renderJobDetail(jobs)
          : this.activeTab === "daemons"
            ? this.renderDaemonDetail(daemons)
            : this.activeTab === "logs"
              ? this.renderLogDetail()
              : this.renderEmptyMain("Select a playbook to run on the left.")}
      </div>
    `;
  }

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
              @click=${() => (this.selectedJobId = job.id)}
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
              @click=${() => (this.selectedDaemonId = d.ticket.id)}
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
                  <div class="block-content mono">${t.outcome}</div>
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
                    <div class="block-content mono">${t.outcome}</div>
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

  private activateLogsTab() {
    this.activeTab = "logs";
    if (!this.logStoreInitialized) {
      this.logStoreInitialized = true;
      this.logStore.init();
    }
  }

  private renderLogsList() {
    const access = this.logStore.accessState.get();

    if (access === "none") {
      return html`
        <div class="jobs-list">
          <div
            style="padding:24px 16px;text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center"
          >
            <button @click=${() => this.logStore.openDirectory()}>
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
            <button @click=${() => this.logStore.requestAccess()}>
              🔑 Grant Access
            </button>
            <div style="font-size:0.75rem;color:#64748b">
              Permission expired — click to re-authorize
            </div>
          </div>
        </div>
      `;
    }

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
                @click=${() =>
                  this.logStore.selectSession(session.sessionId)}
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
    return html`<bees-log-detail .data=${data}></bees-log-detail>`;
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
