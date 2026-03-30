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

export { BeesApp };

interface JobGroup {
  id: string;
  title: string;
  tickets: TicketData[];
  createdAt: string;
  status: "running" | "completed" | "failed" | "suspended" | "pending";
}

@customElement("bees-app")
class BeesApp extends SignalWatcher(LitElement) {
  @state() accessor activeTab: "jobs" | "playbooks" = "jobs";
  @state() accessor selectedJobId: string | null = null;
  @state() accessor playbooks: PlaybookData[] = [];
  @state() accessor loadingPlaybooks = false;

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
  }

  private deriveJobs(): JobGroup[] {
    const tickets = this.scaInst.controller.global.tickets;
    const map = new Map<string, TicketData[]>();

    for (const t of tickets) {
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

    jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return jobs;
  }

  render() {
    const jobs = this.deriveJobs();

    // Auto-select first job
    if (!this.selectedJobId && jobs.length > 0 && this.activeTab === "jobs") {
      this.selectedJobId = jobs[0].id;
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
            class="sidebar-tab ${this.activeTab === "playbooks"
              ? "active"
              : ""}"
            @click=${() => (this.activeTab = "playbooks")}
          >
            Playbooks
          </div>
        </div>

        ${this.activeTab === "jobs"
          ? this.renderJobsList(jobs)
          : this.renderPlaybooksList()}
      </div>

      <div class="main">
        ${this.activeTab === "jobs"
          ? this.renderJobDetail(jobs)
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
            <span>ID: <code class="mono">${job.id.slice(0, 13)}...</code></span>
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
