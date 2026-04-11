/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sidebar list of skills parsed from hive/skills/{name}/SKILL.md.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { SkillStore } from "../data/skill-store.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesSkillList };

@customElement("bees-skill-list")
class BeesSkillList extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  @property({ attribute: false })
  accessor store: SkillStore | null = null;

  render() {
    if (!this.store) return nothing;
    const skills = this.store.skills.get();
    const selectedDir = this.store.selectedSkillDir.get();

    if (skills.length === 0) {
      return html`<div class="empty-state">No skills found.</div>`;
    }

    return html`
      <div class="jobs-list">
        ${skills.map(
          (s) => html`
            <div
              class="job-item ${selectedDir === s.dirName ? "selected" : ""}"
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
    `;
  }

  private handleSelect(dirName: string) {
    this.dispatchEvent(
      new CustomEvent("select", { detail: { dirName }, bubbles: true })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-skill-list": BeesSkillList;
  }
}
