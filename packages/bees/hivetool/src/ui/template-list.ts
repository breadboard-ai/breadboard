/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sidebar list of templates parsed from TEMPLATES.yaml.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { TemplateStore } from "../data/template-store.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesTemplateList };

@customElement("bees-template-list")
class BeesTemplateList extends SignalWatcher(LitElement) {
  static styles = [sharedStyles];

  @property({ attribute: false })
  accessor store: TemplateStore | null = null;

  render() {
    if (!this.store) return nothing;
    const templates = this.store.templates.get();
    const selectedName = this.store.selectedTemplateName.get();

    if (templates.length === 0) {
      return html`<div class="empty-state">No templates found.</div>`;
    }

    return html`
      <div class="jobs-list">
        ${templates.map(
          (t) => html`
            <div
              class="job-item ${selectedName === t.name ? "selected" : ""}"
              @click=${() => this.handleSelect(t.name)}
            >
              <div class="job-header">
                <div class="job-title">${t.title || t.name}</div>
              </div>
              <div class="job-meta">
                <span class="mono">${t.name}</span>
                ${t.model
                  ? html`<span class="template-model-hint">${t.model}</span>`
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
    `;
  }

  private handleSelect(name: string) {
    this.dispatchEvent(
      new CustomEvent("select", { detail: { name }, bubbles: true })
    );
  }

  static {
    // Template-specific sidebar styles.
    const extraStyles = document.createElement("style");
    // Injected inline to avoid a separate styles file for two rules.
    void extraStyles;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-template-list": BeesTemplateList;
  }
}
