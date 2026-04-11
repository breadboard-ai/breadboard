/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sidebar list of skills parsed from hive/skills/{name}/SKILL.md.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { SkillStore } from "../data/skill-store.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesSkillList };

@customElement("bees-skill-list")
class BeesSkillList extends SignalWatcher(LitElement) {
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
    `,
  ];

  @property({ attribute: false })
  accessor store: SkillStore | null = null;

  render() {
    if (!this.store) return nothing;
    const skills = this.store.skills.get();
    const selectedDir = this.store.selectedSkillDir.get();

    return html`
      <div class="sidebar-toolbar">
        <button
          class="add-btn"
          @click=${() => this.handleCreate()}
          title="Create new skill"
        >
          +
        </button>
      </div>
      ${skills.length === 0
        ? html`<div class="empty-state">No skills found.</div>`
        : html`
            <div class="jobs-list">
              ${skills.map(
                (s) => html`
                  <div
                    class="job-item ${selectedDir === s.dirName
                      ? "selected"
                      : ""}"
                    @click=${() => this.handleSelect(s.dirName)}
                  >
                    <div class="job-header">
                      <div class="job-title">${s.title || s.name}</div>
                    </div>
                    <div class="job-meta">
                      <span class="mono">${s.dirName}</span>
                    </div>
                    ${s.description
                      ? html`<div class="job-meta" style="margin-top:2px">
                          <span
                            style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px"
                            >${s.description}</span
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

  private handleSelect(dirName: string) {
    this.dispatchEvent(
      new CustomEvent("select", { detail: { dirName }, bubbles: true })
    );
  }

  private handleCreate() {
    this.dispatchEvent(new Event("create", { bubbles: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-skill-list": BeesSkillList;
  }
}
