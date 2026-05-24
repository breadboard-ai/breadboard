/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import {
  renderJson,
  renderExpandButton,
} from "./json-tree.js";
import type { AgentStore } from "../data/agent-store.js";
import type { TrajectoryStep, TrajectoryData } from "../data/types.js";
import { logDetailStyles } from "./log-detail.styles.js";

export { BeesTrajectoryDetail };

const CONTEXT_UPDATE_RE = /^<context_update>([\s\S]*)<\/context_update>$/;

@customElement("bees-trajectory-detail")
class BeesTrajectoryDetail extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor agentStore: AgentStore | null = null;

  @property({ type: String })
  accessor agentId: string | null = null;

  static styles = [
    ...logDetailStyles,
    css`
      .turn.error {
        background: #2d1616;
        border: 1px solid #5c1e1e;
      }
      .turn.error .turn-role {
        color: #f87171;
      }
      .role-chip.error {
        background: #7f1d1d;
        color: #fca5a5;
      }
      .part-error {
        color: #fca5a5;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .objective-block {
        background: #11141a;
        border: 1px solid #1e293b;
        border-radius: 6px;
        padding: 10px 12px;
        margin-top: 6px;
      }
      .metadata-block {
        font-size: 0.75rem;
        color: #64748b;
        margin-top: 4px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .metadata-block code {
        background: #1e293b;
        padding: 1px 4px;
        border-radius: 3px;
        color: #e2e8f0;
        word-break: break-all;
      }
    `,
  ];

  render() {
    if (!this.agentStore || !this.agentId) {
      return html`<div class="empty">Select a trajectory to inspect.</div>`;
    }

    const trajs = this.agentStore.trajectories.get();
    const traj = trajs.find((t) => t.agentId === this.agentId);

    if (!traj) {
      return html`<div class="empty">Trajectory not found.</div>`;
    }

    return html`
      ${this.renderHeader(traj)}
      <div class="conversation">
        ${traj.steps.map((step) => html`
          ${this.renderStepHeader(step)}
          ${this.renderStep(step)}
        `)}
      </div>
    `;
  }

  private renderStepHeader(step: TrajectoryStep) {
    return html`
      <div class="turn-header">
        <span class="turn-header-label">step ${step.step_index}</span>
        ${step.timestamp ? html`<span class="mono" style="font-size: 0.65rem; color: #475569; margin-left: 8px;">${step.timestamp}</span>` : nothing}
        <div style="flex: 1; height: 1px; background: #1e293b; margin-left: 8px;"></div>
      </div>
    `;
  }

  private renderHeader(t: TrajectoryData) {
    const started = t.steps[0]?.timestamp;
    return html`
      <div class="header">
        <div class="header-top">
          <h2>
            Trajectory
            <code class="mono">${t.trajectoryId.slice(0, 13)}…</code>
          </h2>
          <span
            class="link-chip"
            @click=${() => this.#dispatchNavigate("agent", t.agentId)}
          >
            <span class="link-chip-label">agent</span>
            ${t.agentId.slice(0, 8)}
          </span>
        </div>
        <div class="header-meta">
          <span>${started ? started : "—"}</span>
          <span>${t.steps.length} step${t.steps.length !== 1 ? "s" : ""}</span>
          <span>Status: ${t.agentStatus}</span>
        </div>
      </div>
    `;
  }

  private renderStep(step: TrajectoryStep) {
    const type = step.type || "unknown";

    switch (type) {
      case "user_input":
        return this.renderUserInputStep(step);
      case "model_output":
        return this.renderModelOutputStep(step);
      case "tool_response":
        return this.renderToolResponseStep(step);
      case "complete":
        return this.renderCompleteStep(step);
      case "error":
        return this.renderErrorStep(step);
      default:
        return this.renderUnknownStep(step);
    }
  }

  private renderUserInputStep(step: TrajectoryStep) {
    const content = step.content || "";

    // 1. Check for context_update
    const cuMatch = content.match(CONTEXT_UPDATE_RE);
    if (cuMatch) {
      const label = html`<span class="role-chip context-update">context update</span>`;
      return html`
        <div class="turn context-update">
          <div class="turn-role">${label}</div>
          <div class="turn-parts">
            <div class="part-text">${cuMatch[1].trim()}</div>
          </div>
        </div>
      `;
    }

    // 2. Parse initial prompt metadata / objective
    const objMatch = content.match(/<objective>([\s\S]*?)<\/objective>/);
    const wdMatch = content.match(/<working_directory>([\s\S]*?)<\/working_directory>/);
    const dateMatch = content.match(/<current_date>([\s\S]*?)<\/current_date>/);

    const label = html`<span class="role-chip user">user</span>`;

    if (objMatch) {
      return html`
        <div class="turn user">
          <div class="turn-role">${label}</div>
          <div class="turn-parts">
            <div class="objective-block">
              <strong>Objective:</strong>
              <div style="white-space: pre-wrap; margin-top: 4px;">${objMatch[1].trim()}</div>
            </div>
            ${wdMatch || dateMatch
              ? html`
                  <div class="metadata-block">
                    ${dateMatch ? html`<span><strong>Date:</strong> ${dateMatch[1].trim()}</span>` : nothing}
                    ${wdMatch ? html`<span><strong>Workspace:</strong> <code class="mono">${wdMatch[1].trim()}</code></span>` : nothing}
                  </div>
                `
              : nothing}
          </div>
        </div>
      `;
    }

    return html`
      <div class="turn user">
        <div class="turn-role">${label}</div>
        <div class="turn-parts">
          <div class="part-text">${content}</div>
        </div>
      </div>
    `;
  }

  private renderModelOutputStep(step: TrajectoryStep) {
    const templates = [];

    // Render thoughts if present
    if (step.thought) {
      const { title, body } = this.#parseThought(step.thought);
      const label = title
        ? html`<span class="role-chip thought">thought</span> ${title}`
        : html`<span class="role-chip thought">thought</span>`;
      const isLong = body.length > 300;

      templates.push(html`
        <div class="turn thought">
          <div class="turn-role">${label}</div>
          <div class="turn-parts">
            <div class="part-thought ${isLong ? "long" : ""}">${body}${isLong ? renderExpandButton() : nothing}</div>
          </div>
        </div>
      `);
    }

    // Render tool calls if present
    if (step.tool_calls && step.tool_calls.length > 0) {
      for (const tc of step.tool_calls) {
        const label = html`<span class="role-chip call">call</span> ${tc.name}`;
        templates.push(html`
          <div class="turn call">
            <div class="turn-role">${label}</div>
            <div class="turn-parts">
              <div class="json-tree">${renderJson(tc.arguments)}</div>
            </div>
          </div>
        `);
      }
    }

    // Render plain text content if present (and not already shown as thought/calls)
    if (step.content && step.content.trim() !== "") {
      const isLong = step.content.length > 500;
      templates.push(html`
        <div class="turn model">
          <div class="turn-role"><span class="role-chip model">model</span></div>
          <div class="turn-parts">
            <div class="part-text ${isLong ? "long" : ""}">${step.content}${isLong ? renderExpandButton() : nothing}</div>
          </div>
        </div>
      `);
    }

    return html`${templates}`;
  }

  private renderToolResponseStep(step: TrajectoryStep) {
    const name = step.tool_name || "unknown";
    const label = html`<span class="role-chip response">response</span> ${name}`;
    return html`
      <div class="turn system">
        <div class="turn-role">${label}</div>
        <div class="turn-parts">
          <div class="part-function-response">
            <div class="json-tree">${renderJson(step.response)}</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderCompleteStep(step: TrajectoryStep) {
    const label = html`<span class="role-chip system-message">system</span>`;
    const outcome = step.outcome;

    if (outcome && typeof outcome === "object") {
      const objOutcome = (outcome as Record<string, unknown>).objective_outcome;
      if (typeof objOutcome === "string") {
        return html`
          <div class="turn system-message">
            <div class="turn-role">${label}</div>
            <div class="turn-parts">
              <div class="part-system-message">${objOutcome}</div>
            </div>
          </div>
        `;
      }
    }

    return html`
      <div class="turn system-message">
        <div class="turn-role">${label}</div>
        <div class="turn-parts">
          <div class="part-system-message">
            <div class="json-tree">${renderJson(outcome)}</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderErrorStep(step: TrajectoryStep) {
    const label = html`<span class="role-chip error">error</span>`;
    return html`
      <div class="turn error">
        <div class="turn-role">${label}</div>
        <div class="turn-parts">
          <div class="part-error">${step.error || "An error occurred."}</div>
        </div>
      </div>
    `;
  }

  private renderUnknownStep(step: TrajectoryStep) {
    const label = html`<span class="role-chip inherited">step</span>`;
    return html`
      <div class="turn inherited">
        <div class="turn-role">${label} ${step.type}</div>
        <div class="turn-parts">
          <div class="json-tree">${renderJson(step)}</div>
        </div>
      </div>
    `;
  }

  #parseThought(text: string): { title: string | null; body: string } {
    const match = text.match(/\*\*(.+?)\*\*/);
    if (!match) return { title: null, body: text };
    const title = match[1];
    const body = text.replace(match[0], "").trim();
    return { title, body };
  }

  #dispatchNavigate(tab: string, id: string) {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { tab, id },
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-trajectory-detail": BeesTrajectoryDetail;
  }
}
