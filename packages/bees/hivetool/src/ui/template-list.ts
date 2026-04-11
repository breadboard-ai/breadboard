/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sidebar list of templates parsed from TEMPLATES.yaml.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { TemplateStore } from "../data/template-store.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesTemplateList };

@customElement("bees-template-list")
class BeesTemplateList extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      .sidebar-toolbar {
        display: flex;
        justify-content: flex-end;
        padding: 8px 12px 0;
        flex-shrink: 0;
      }

      .add-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        font-size: 1rem;
        background: transparent;
        color: #64748b;
        border: 1px solid #334155;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      }

      .add-btn:hover {
        color: #e2e8f0;
        border-color: #3b82f6;
        background: #1e293b;
      }

      .template-model-hint {
        font-size: 0.65rem;
        color: #c4b5fd;
        font-family: "Google Mono", "Roboto Mono", monospace;
      }
    `,
  ];

  @property({ attribute: false })
  accessor store: TemplateStore | null = null;

  render() {
    if (!this.store) return nothing;
    const templates = this.store.templates.get();
    const selectedName = this.store.selectedTemplateName.get();

    return html`
      <div class="sidebar-toolbar">
        <button
          class="add-btn"
          @click=${() => this.handleCreate()}
          title="Create new template"
        >
          +
        </button>
      </div>
      ${templates.length === 0
        ? html`<div class="empty-state">No templates found.</div>`
        : html`
            <div class="jobs-list">
              ${templates.map(
                (t) => html`
                  <div
                    class="job-item ${selectedName === t.name
                      ? "selected"
                      : ""}"
                    @click=${() => this.handleSelect(t.name)}
                  >
                    <div class="job-header">
                      <div class="job-title">${t.title || t.name}</div>
                    </div>
                    <div class="job-meta">
                      <span class="mono">${t.name}</span>
                      ${t.model
                        ? html`<span class="template-model-hint"
                            >${t.model}</span
                          >`
                        : nothing}
                    </div>
                    ${t.description
                      ? html`<div class="job-meta" style="margin-top:2px">
                          <span
                            style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px"
                            >${t.description}</span
                          >
                        </div>`
                      : nothing}
                  </div>
                `
              )}
            </div>
          `}
    `;
  }

  private handleSelect(name: string) {
    this.dispatchEvent(
      new CustomEvent("select", { detail: { name }, bubbles: true })
    );
  }

  private handleCreate() {
    this.dispatchEvent(new Event("create", { bubbles: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-template-list": BeesTemplateList;
  }
}
