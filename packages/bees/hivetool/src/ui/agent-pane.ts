/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent pane — wrapper that owns the agent header, tab bar, and view
 * switching between the Surface and Detail tabs.
 *
 * The header (title, status badge, identity chips, agent controls) is
 * shared across both tabs. Below it sits a `Surface · Detail` tab bar.
 * Each tab body gets the remaining vertical space.
 *
 * Defaults to the Surface tab when a surface or chat content exists
 * for the selected agent, and to the Detail tab otherwise.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { AgentStore } from "../data/agent-store.js";
import type { MutationClient } from "../data/mutation-client.js";
import type { TemplateStore } from "../data/template-store.js";
import type { SkillStore } from "../data/skill-store.js";
import type { StateAccess } from "../data/state-access.js";
import { sharedStyles } from "./shared-styles.js";
import { hasChatContent } from "./chat-panel.js";
import "./agent-detail.js";
import "./surface-pane.js";

export { BeesAgentPane };

type PaneTab = "surface" | "detail";

@customElement("bees-agent-pane")
class BeesAgentPane extends SignalWatcher(LitElement) {
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
        align-items: center;
        padding: 0 32px;
        border-bottom: 1px solid #1e293b;
        background: #0f1115;
        flex-shrink: 0;
      }

      .maximize-btn {
        margin-left: auto;
        padding: 4px 6px;
        background: none;
        border: none;
        cursor: pointer;
        color: #64748b;
        font-size: 0.85rem;
        line-height: 1;
        border-radius: 4px;
        transition: color 0.15s, background 0.15s;
      }

      .maximize-btn:hover {
        color: #e2e8f0;
        background: #1e293b;
      }

      .maximize-btn.active {
        color: #60a5fa;
        background: #1e3a5f33;
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
  accessor agentStore: AgentStore | null = null;

  @property({ attribute: false })
  accessor stateAccess: StateAccess | null = null;

  @property({ attribute: false })
  accessor mutationClient: MutationClient | null = null;

  @property({ attribute: false })
  accessor templateStore: TemplateStore | null = null;

  @property({ attribute: false })
  accessor skillStore: SkillStore | null = null;

  @property({ attribute: false })
  accessor flashAgentId: string | null = null;

  @property({ type: Boolean })
  accessor maximized = false;

  @state() accessor activePane: PaneTab = "detail";
  @state() accessor hasSurfaceManifest = false;

  /**
   * Track the agent ID for which we last probed,
   * so we only re-probe on agent change, not on every render.
   */
  #probedFor: string | null = null;
  #autoSwitchedFor: string | null = null;

  render() {
    if (!this.agentStore) return nothing;
    const agent = this.agentStore.selectedAgent.get();
    if (!agent)
      return html`<div class="empty-state">
        Select an agent to view details
      </div>`;

    // Probe for surface.json on agent change (async, once per agent).
    if (this.#probedFor !== agent.id) {
      this.#probedFor = agent.id;
      this.#autoSwitchedFor = null;
      this.hasSurfaceManifest = false;
      this.activePane = "detail";
      this.probeSurface(agent.id);
    }

    // Chat content is signal-derived — check reactively every render.
    const chatActive = hasChatContent(agent);
    const showSurface = this.hasSurfaceManifest || chatActive;

    // Auto-switch to Surface tab when content first appears.
    if (showSurface && this.#autoSwitchedFor !== agent.id) {
      this.#autoSwitchedFor = agent.id;
      this.activePane = "surface";
    }

    const suspendFn =
      agent.suspend_event?.function_name as string | undefined;
    const isAwaitSuspend =
      suspendFn === "chat_await_context_update" ||
      suspendFn === "tasks_await" ||
      suspendFn === "agents_await" ||
      suspendFn === "events_yield";
    const statusLabel =
      agent.status === "suspended" &&
      agent.assignee === "user" &&
      !isAwaitSuspend
        ? "waiting for user"
        : agent.status === "suspended" && suspendFn === "events_yield"
          ? "waiting for task"
          : agent.status === "suspended"
            ? "waiting for event"
            : agent.status;

    // Collect identity chips.
    const identityChips: Array<{
      label: string;
      value: string;
      cls?: string;
      onclick?: () => void;
    }> = [];
    if (agent.model)
      identityChips.push({
        label: "model",
        value: agent.model,
        cls: "model",
      });
    if (agent.playbook_id) {
      const templateNames = new Set(
        (this.templateStore?.templates.get() ?? []).map((t) => t.name)
      );
      const exists = templateNames.has(agent.playbook_id);
      identityChips.push({
        label: "template",
        value: agent.playbook_id,
        cls: "playbook",
        onclick: exists
          ? () => this.navigate("templates", agent.playbook_id!)
          : undefined,
      });
    }
    if (agent.creator_ticket_id)
      identityChips.push({
        label: "parent",
        value: agent.creator_ticket_id.slice(0, 8),
        onclick: () => this.navigate("agents", agent.creator_ticket_id!),
      });
    if (agent.owning_task_id)
      identityChips.push({
        label: "fs owner",
        value: agent.owning_task_id.slice(0, 8),
        onclick: () => this.navigate("agents", agent.owning_task_id!),
      });
    const sessionVal = agent.active_session || agent.id;
    identityChips.push({
      label: "session",
      value: sessionVal.slice(0, 8),
      onclick: () => this.navigate("logs", sessionVal),
    });
    if (agent.skills && agent.skills.length > 0) {
      const skillDirs = new Set(
        (this.skillStore?.skills.get() ?? []).map((sk) => sk.dirName)
      );
      for (const s of agent.skills)
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
        class="job-detail ${this.flashAgentId === agent.id
          ? "lightning-flash"
          : ""}"
      >
        ${this.maximized ? nothing : html`
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${agent.title || "Agent"}</h2>
            <div style="display:flex;align-items:center;gap:8px">
              ${this.renderAgentControl(agent.id, agent.status)}
              <div class="job-detail-badge ${agent.status}">${statusLabel}</div>
            </div>
          </div>
          <div class="job-detail-meta">
            <span
              >ID: <code class="mono">${agent.id.slice(0, 13)}...</code></span
            >
            <span
              >Created:
              ${new Date(agent.created_at ?? "").toLocaleString()}</span
            >
            ${agent.completed_at
              ? html`<span
                  >Completed:
                  ${new Date(agent.completed_at).toLocaleString()}</span
                >`
              : nothing}
            ${agent.turns
              ? html`<span>${agent.turns} turns</span>`
              : nothing}
            ${agent.thoughts
              ? html`<span>${agent.thoughts} thoughts</span>`
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
              </div>
            `
          : nothing}
        `}

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
                <button
                  class="maximize-btn ${this.maximized ? "active" : ""}"
                  title="Toggle maximize"
                  @click=${() => this.#toggleMaximize()}
                >⛶</button>
              </div>

              <div class="tab-body">
                ${this.activePane === "surface"
                  ? html`<bees-surface-pane
                      .agentStore=${this.agentStore}
                      .mutationClient=${this.mutationClient}
                      .agentId=${agent.id}
                    ></bees-surface-pane>`
                  : html`<bees-agent-detail
                      .agentStore=${this.agentStore}
                      .stateAccess=${this.stateAccess}
                      .mutationClient=${this.mutationClient}
                      .flashAgentId=${this.flashAgentId}
                    ></bees-agent-detail>`}
              </div>
            `
          : html`
              <div class="pane-tabs">
                <button
                  class="maximize-btn ${this.maximized ? "active" : ""}"
                  title="Toggle maximize"
                  @click=${() => this.#toggleMaximize()}
                >⛶</button>
              </div>
              <div class="tab-body">
                <bees-agent-detail
                  .agentStore=${this.agentStore}
                  .stateAccess=${this.stateAccess}
                  .mutationClient=${this.mutationClient}
                  .flashAgentId=${this.flashAgentId}
                ></bees-agent-detail>
              </div>
            `}
      </div>
    `;
  }

  // ── Per-agent pause / resume ──

  private renderAgentControl(agentId: string, status: string) {
    if (!this.mutationClient?.boxActive.get()) return nothing;

    const ACTIVE = new Set(["running", "available", "suspended", "blocked"]);

    const deleteBtn = html`
      <button
        style="padding:3px 10px;font-size:0.65rem;font-weight:600;
               background:transparent;color:#64748b;border:1px solid #334155;
               border-radius:4px;cursor:pointer;font-family:inherit;
               transition:all 0.15s"
        @click=${() => this.handleDeleteAgent(agentId)}
      >
        🗑 Delete
      </button>
    `;

    if (ACTIVE.has(status)) {
      return html`
        <button
          style="padding:3px 10px;font-size:0.65rem;font-weight:600;
                 background:transparent;color:#f87171;border:1px solid #991b1b;
                 border-radius:4px;cursor:pointer;font-family:inherit;
                 transition:all 0.15s"
          @click=${() => this.handlePauseAgent(agentId)}
        >
          ⏸ Pause
        </button>
        ${deleteBtn}
      `;
    }

    if (status === "paused") {
      return html`
        <button
          style="padding:3px 10px;font-size:0.65rem;font-weight:600;
                 background:transparent;color:#4ade80;border:1px solid #166534;
                 border-radius:4px;cursor:pointer;font-family:inherit;
                 transition:all 0.15s"
          @click=${() => this.handleResumeAgent(agentId)}
        >
          ▶ Resume
        </button>
        ${deleteBtn}
      `;
    }

    return deleteBtn;
  }

  private async handlePauseAgent(agentId: string) {
    if (!this.mutationClient) return;
    try {
      await this.mutationClient.pauseTask(agentId);
    } catch (e) {
      console.error("Failed to pause agent:", e);
    }
  }

  private async handleResumeAgent(agentId: string) {
    if (!this.mutationClient) return;
    try {
      await this.mutationClient.resumeTask(agentId);
    } catch (e) {
      console.error("Failed to resume agent:", e);
    }
  }

  private async handleDeleteAgent(agentId: string) {
    if (!this.mutationClient) return;

    const confirmed = confirm(
      "Delete this agent and all its children? This removes the agent, " +
      "its session logs, and all descendant agents."
    );
    if (!confirmed) return;

    try {
      await this.mutationClient.deleteTask(agentId);
      // Deselect the agent — it no longer exists.
      this.agentStore?.selectAgent(null);
    } catch (e) {
      console.error("Failed to delete agent:", e);
    }
  }

  // ── Surface probe ──

  private async probeSurface(agentId: string): Promise<void> {
    if (!this.agentStore) return;

    const surface = await this.agentStore.readSurface(agentId);

    // Only apply if we're still looking at the same agent.
    if (this.#probedFor === agentId) {
      this.hasSurfaceManifest = surface !== null;
      if (surface !== null) {
        this.activePane = "surface";
      }
    }
  }

  // ── Maximize ──

  #toggleMaximize() {
    this.dispatchEvent(
      new CustomEvent("toggle-maximize", { bubbles: true })
    );
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
    "bees-agent-pane": BeesAgentPane;
  }
}
