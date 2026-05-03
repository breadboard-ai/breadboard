/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Ticket pane — wrapper that owns the ticket header, tab bar, and view
 * switching between the Surface and Detail tabs.
 *
 * The header (title, status badge, identity chips, task controls) is
 * shared across both tabs. Below it sits a `Surface · Detail` tab bar.
 * Each tab body gets the remaining vertical space.
 *
 * Defaults to the Surface tab when a surface or chat content exists
 * for the selected ticket, and to the Detail tab otherwise.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { TicketStore } from "../data/ticket-store.js";
import type { MutationClient } from "../data/mutation-client.js";
import type { TemplateStore } from "../data/template-store.js";
import type { SkillStore } from "../data/skill-store.js";
import { sharedStyles } from "./shared-styles.js";
import { hasChatContent } from "./chat-panel.js";
import "./ticket-detail.js";
import "./surface-pane.js";

export { BeesTicketPane };

type PaneTab = "surface" | "detail";

@customElement("bees-ticket-pane")
class BeesTicketPane extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
      }

      /* ── Tab bar ── */
      .pane-tabs {
        display: flex;
        padding: 0 32px;
        border-bottom: 1px solid #1e293b;
        background: #0f1115;
        flex-shrink: 0;
      }

      .pane-tab {
        padding: 8px 14px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: color 0.15s;
        user-select: none;
      }

      .pane-tab.active {
        color: #f8fafc;
        border-bottom-color: #3b82f6;
      }

      .pane-tab:hover:not(.active) {
        color: #cbd5e1;
      }

      /* ── Tab body ── */
      .tab-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: auto;
      }
    `,
  ];

  @property({ attribute: false })
  accessor ticketStore: TicketStore | null = null;

  @property({ attribute: false })
  accessor mutationClient: MutationClient | null = null;

  @property({ attribute: false })
  accessor templateStore: TemplateStore | null = null;

  @property({ attribute: false })
  accessor skillStore: SkillStore | null = null;

  @property({ attribute: false })
  accessor flashTicketId: string | null = null;

  @state() accessor activePane: PaneTab = "detail";
  @state() accessor hasSurfaceManifest = false;

  /**
   * Track the ticket ID for which we last probed,
   * so we only re-probe on ticket change, not on every render.
   */
  #probedFor: string | null = null;

  render() {
    if (!this.ticketStore) return nothing;
    const ticket = this.ticketStore.selectedTicket.get();
    if (!ticket)
      return html`<div class="empty-state">
        Select a ticket to view details
      </div>`;

    // Probe for surface.json on ticket change (async, once per ticket).
    if (this.#probedFor !== ticket.id) {
      this.#probedFor = ticket.id;
      this.hasSurfaceManifest = false;
      this.activePane = "detail";
      this.probeSurface(ticket.id);
    }

    // Chat content is signal-derived — check reactively every render.
    const chatActive = hasChatContent(ticket);
    const showSurface = this.hasSurfaceManifest || chatActive;

    // Auto-switch to Surface tab when content first appears.
    if (showSurface && this.activePane === "detail" && !this.hasSurfaceManifest) {
      this.activePane = "surface";
    }

    const suspendFn =
      ticket.suspend_event?.function_name as string | undefined;
    const statusLabel =
      ticket.status === "suspended" &&
      ticket.assignee === "user" &&
      suspendFn !== "chat_await_context_update"
        ? "waiting for user"
        : ticket.status === "suspended"
          ? "waiting for event"
          : ticket.status;

    // Collect identity chips.
    const identityChips: Array<{
      label: string;
      value: string;
      cls?: string;
      onclick?: () => void;
    }> = [];
    if (ticket.model)
      identityChips.push({
        label: "model",
        value: ticket.model,
        cls: "model",
      });
    if (ticket.playbook_id) {
      const templateNames = new Set(
        (this.templateStore?.templates.get() ?? []).map((t) => t.name)
      );
      const exists = templateNames.has(ticket.playbook_id);
      identityChips.push({
        label: "template",
        value: ticket.playbook_id,
        cls: "playbook",
        onclick: exists
          ? () => this.navigate("templates", ticket.playbook_id!)
          : undefined,
      });
    }
    if (ticket.creator_ticket_id)
      identityChips.push({
        label: "parent",
        value: ticket.creator_ticket_id.slice(0, 8),
        onclick: () => this.navigate("tickets", ticket.creator_ticket_id!),
      });
    if (ticket.owning_task_id)
      identityChips.push({
        label: "fs owner",
        value: ticket.owning_task_id.slice(0, 8),
        onclick: () => this.navigate("tickets", ticket.owning_task_id!),
      });
    identityChips.push({
      label: "session",
      value: ticket.id.slice(0, 8),
      onclick: () => this.navigate("logs", ticket.id),
    });
    if (ticket.skills && ticket.skills.length > 0) {
      const skillDirs = new Set(
        (this.skillStore?.skills.get() ?? []).map((sk) => sk.dirName)
      );
      for (const s of ticket.skills)
        identityChips.push({
          label: "skill",
          value: s,
          cls: "skill",
          onclick: skillDirs.has(s)
            ? () => this.navigate("skills", s)
            : undefined,
        });
    }

    return html`
      <div
        class="job-detail ${this.flashTicketId === ticket.id
          ? "lightning-flash"
          : ""}"
      >
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${ticket.title || "Ticket"}</h2>
            <div style="display:flex;align-items:center;gap:8px">
              ${this.renderTaskControl(ticket.id, ticket.status)}
              <div class="job-detail-badge ${ticket.status}">${statusLabel}</div>
            </div>
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
            ${ticket.turns
              ? html`<span>${ticket.turns} turns</span>`
              : nothing}
            ${ticket.thoughts
              ? html`<span>${ticket.thoughts} thoughts</span>`
              : nothing}
          </div>
        </div>

        ${identityChips.length > 0
          ? html`
              <div
                class="identity-row"
                style="padding: 8px 32px; border-bottom: 1px solid #1e293b"
              >
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

        ${showSurface
          ? html`
              <div class="pane-tabs">
                <div
                  class="pane-tab ${this.activePane === "surface" ? "active" : ""}"
                  @click=${() => { this.activePane = "surface"; }}
                >
                  Surface
                </div>
                <div
                  class="pane-tab ${this.activePane === "detail" ? "active" : ""}"
                  @click=${() => { this.activePane = "detail"; }}
                >
                  Detail
                </div>
              </div>

              <div class="tab-body">
                ${this.activePane === "surface"
                  ? html`<bees-surface-pane
                      .ticketStore=${this.ticketStore}
                      .mutationClient=${this.mutationClient}
                      .ticketId=${ticket.id}
                    ></bees-surface-pane>`
                  : html`<bees-ticket-detail
                      .ticketStore=${this.ticketStore}
                      .mutationClient=${this.mutationClient}
                      .flashTicketId=${this.flashTicketId}
                    ></bees-ticket-detail>`}
              </div>
            `
          : html`
              <div class="tab-body">
                <bees-ticket-detail
                  .ticketStore=${this.ticketStore}
                  .mutationClient=${this.mutationClient}
                  .flashTicketId=${this.flashTicketId}
                ></bees-ticket-detail>
              </div>
            `}
      </div>
    `;
  }

  // ── Per-task pause / resume (lifted from ticket-detail) ──

  private renderTaskControl(taskId: string, status: string) {
    if (!this.mutationClient?.boxActive.get()) return nothing;

    const ACTIVE = new Set(["running", "available", "suspended", "blocked"]);

    if (ACTIVE.has(status)) {
      return html`
        <button
          style="padding:3px 10px;font-size:0.65rem;font-weight:600;
                 background:transparent;color:#f87171;border:1px solid #991b1b;
                 border-radius:4px;cursor:pointer;font-family:inherit;
                 transition:all 0.15s"
          @click=${() => this.handlePauseTask(taskId)}
        >
          ⏸ Pause
        </button>
      `;
    }

    if (status === "paused") {
      return html`
        <button
          style="padding:3px 10px;font-size:0.65rem;font-weight:600;
                 background:transparent;color:#4ade80;border:1px solid #166534;
                 border-radius:4px;cursor:pointer;font-family:inherit;
                 transition:all 0.15s"
          @click=${() => this.handleResumeTask(taskId)}
        >
          ▶ Resume
        </button>
      `;
    }

    return nothing;
  }

  private async handlePauseTask(taskId: string) {
    if (!this.mutationClient) return;
    try {
      await this.mutationClient.pauseTask(taskId);
    } catch (e) {
      console.error("Failed to pause task:", e);
    }
  }

  private async handleResumeTask(taskId: string) {
    if (!this.mutationClient) return;
    try {
      await this.mutationClient.resumeTask(taskId);
    } catch (e) {
      console.error("Failed to resume task:", e);
    }
  }

  // ── Surface probe ──

  private async probeSurface(ticketId: string): Promise<void> {
    if (!this.ticketStore) return;

    const surface = await this.ticketStore.readSurface(ticketId);

    // Only apply if we're still looking at the same ticket.
    if (this.#probedFor === ticketId) {
      this.hasSurfaceManifest = surface !== null;
      if (surface !== null) {
        this.activePane = "surface";
      }
    }
  }

  // ── Navigation ──

  private navigate(tab: string, id: string) {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { tab, id },
        bubbles: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-ticket-pane": BeesTicketPane;
  }
}
