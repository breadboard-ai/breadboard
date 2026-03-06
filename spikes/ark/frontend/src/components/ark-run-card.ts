/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { type RunSummary } from "../services/backend.js";

export { ArkRunCard };

/**
 * Run card — displays a single run's objective, status, and progress.
 *
 * Clicking a completed run dispatches `open-bundle` to trigger bundle
 * fetching and full-screen rendering. Running runs show live progress.
 */
@customElement("ark-run-card")
class ArkRunCard extends LitElement {
  @property({ type: Object }) run!: RunSummary;

  static override styles = css`
    :host {
      display: block;
    }

    .card {
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
      background: #fff;
      cursor: pointer;
    }

    .card:hover {
      border-color: #ccc;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .card[data-complete]:hover {
      border-color: var(--ark-accent, #0d9488);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      user-select: none;
    }

    .objective {
      font-weight: 600;
      font-size: 14px;
      color: #1a1a2e;
    }

    .status {
      font-size: 13px;
      color: #888;
      flex-shrink: 0;
    }

    .status[data-complete] {
      color: #22c55e;
    }

    .progress-bar {
      height: 3px;
      background: #f0f0f0;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--ark-accent, #0d9488);
      transition: width 0.3s ease;
    }

    .progress-fill[data-complete] {
      background: #22c55e;
    }

    .step-detail {
      padding: 8px 18px 14px;
      font-size: 13px;
      color: #888;
    }
  `;

  override render() {
    const run = this.run;
    if (!run) return nothing;

    const pct =
      run.total_steps > 0
        ? Math.round((run.progress / run.total_steps) * 100)
        : 0;
    const isComplete = run.status === "complete";

    return html`
      <div class="card" ?data-complete=${isComplete} @click=${this.#onClick}>
        <div class="header">
          <span class="objective">${run.objective}</span>
          <span class="status" ?data-complete=${isComplete}>
            ${isComplete ? "✅ Done — click to open" : `⏳ ${run.current_step}`}
          </span>
        </div>

        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: ${pct}%"
            ?data-complete=${isComplete}
          ></div>
        </div>

        ${!isComplete
          ? html`<div class="step-detail">${run.current_detail}</div>`
          : nothing}
      </div>
    `;
  }

  #onClick() {
    const run = this.run;
    if (run.status === "complete") {
      this.dispatchEvent(
        new CustomEvent("open-bundle", {
          detail: { id: run.id },
          bubbles: true,
          composed: true,
        })
      );
    }
  }
}
