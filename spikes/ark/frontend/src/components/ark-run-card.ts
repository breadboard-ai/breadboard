/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { type RunSummary } from "../services/backend.js";

export { ArkRunCard };

/**
 * Minimal inline markdown → HTML for agent thoughts.
 */
function renderMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

/**
 * Run card — displays a single run's objective, status, and progress.
 *
 * Monochrome design — all greys and black, no color. Completed runs
 * are clickable to open the bundle in full-screen viewport mode.
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
      border-radius: 8px;
      overflow: hidden;
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
      background: #fff;
      cursor: pointer;
    }

    .card:hover {
      border-color: #bbb;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .card[data-complete]:hover {
      border-color: #888;
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
      color: #1a1a1a;
      flex: 1;
      min-width: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .status {
      font-size: 12px;
      color: #999;
      font-family: "SF Mono", "Menlo", monospace;
    }

    .status[data-complete] {
      color: #555;
    }

    .delete-btn {
      border: none;
      background: transparent;
      color: #ccc;
      cursor: pointer;
      font-size: 16px;
      padding: 2px 6px;
      border-radius: 4px;
      line-height: 1;
      transition:
        color 0.15s,
        background 0.15s;
    }

    .delete-btn:hover {
      color: #666;
      background: rgba(0, 0, 0, 0.05);
    }

    .progress-bar {
      height: 2px;
      background: #f0f0f0;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #999;
      transition: width 0.3s ease;
    }

    .progress-fill[data-complete] {
      background: #444;
    }

    .step-detail {
      padding: 8px 18px 14px;
      font-size: 13px;
      color: #888;
    }

    .step-detail code {
      background: #f0f0f0;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 12px;
    }
  `;

  override render() {
    const run = this.run;
    if (!run) return nothing;

    const isComplete = run.status === "complete";
    const pct = isComplete
      ? 100
      : run.total_steps > 0
        ? Math.min(100, Math.round((run.progress / run.total_steps) * 100))
        : 0;

    return html`
      <div class="card" ?data-complete=${isComplete} @click=${this.#onClick}>
        <div class="header">
          <span class="objective">${run.objective}</span>
          <div class="header-actions">
            <span class="status" ?data-complete=${isComplete}>
              ${isComplete ? "done" : run.current_step}
            </span>
            <button
              class="delete-btn"
              title="Delete run"
              @click=${this.#onDelete}
            >
              ×
            </button>
          </div>
        </div>

        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: ${pct}%"
            ?data-complete=${isComplete}
          ></div>
        </div>

        ${!isComplete
          ? html`<div class="step-detail">
              ${unsafeHTML(renderMarkdown(run.current_detail))}
            </div>`
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

  #onDelete(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("delete-run", {
        detail: { id: this.run.id },
        bubbles: true,
        composed: true,
      })
    );
  }
}
