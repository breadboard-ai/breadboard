/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Detail panel for a selected template.
 *
 * Renders the template's metadata, objective, delegation targets, tags,
 * skills, functions, watch events, and backlinks to tickets using
 * that template.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { TemplateStore } from "../data/template-store.js";
import type { SkillStore } from "../data/skill-store.js";
import type { TicketStore } from "../data/ticket-store.js";
import { sharedStyles } from "./shared-styles.js";
import "./truncated-text.js";

export { BeesTemplateDetail };

@customElement("bees-template-detail")
class BeesTemplateDetail extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      .template-badge {
        font-size: 0.65rem;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: #134e4a33;
        color: #5eead4;
        border: 1px solid #134e4a;
      }

      .template-tasks-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }

      .template-task-chip {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-family: "Google Mono", "Roboto Mono", monospace;
        background: #111d1f;
        color: #5eead4;
        border: 1px solid #1a3338;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }

      .template-task-chip.linkable {
        cursor: pointer;
      }

      .template-task-chip.linkable:hover {
        background: #1a3338;
        border-color: #2dd4bf;
        color: #99f6e4;
      }
    `,
  ];

  @property({ attribute: false })
  accessor templateStore: TemplateStore | null = null;

  @property({ attribute: false })
  accessor skillStore: SkillStore | null = null;

  @property({ attribute: false })
  accessor ticketStore: TicketStore | null = null;

  render() {
    if (!this.templateStore) return nothing;
    const template = this.templateStore.selectedTemplate.get();
    if (!template)
      return html`<div class="empty-state">
        Select a template to view details
      </div>`;

    // Build identity chips.
    const chips: Array<{
      label: string;
      value: string;
      cls?: string;
      onclick?: () => void;
    }> = [];
    chips.push({ label: "name", value: template.name, cls: "playbook" });
    if (template.model)
      chips.push({ label: "model", value: template.model, cls: "model" });
    if (template.assignee)
      chips.push({ label: "assignee", value: template.assignee });

    // Resolve delegation targets — check which names exist as templates.
    const allTemplates = this.templateStore.templates.get();
    const templateNames = new Set(allTemplates.map((t) => t.name));

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${template.title || template.name}</h2>
            <div class="template-badge">TEMPLATE</div>
          </div>
          ${template.description
            ? html`<div class="job-detail-meta">
                <span>${template.description}</span>
              </div>`
            : nothing}
        </div>

        <div class="timeline">
          ${chips.length > 0
            ? html`
                <div class="identity-row">
                  ${chips.map(
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
          ${template.objective
            ? html`
                <div class="block">
                  <div class="block-header">Objective</div>
                  <div class="block-content">
                    <bees-truncated-text
                      threshold="500"
                      max-height="300"
                      fadeBg="#0f1115"
                      >${template.objective}</bees-truncated-text
                    >
                  </div>
                </div>
              `
            : nothing}
          ${template.tasks && template.tasks.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Subtask Templates</div>
                  <div class="block-content">
                    <div class="template-tasks-list">
                      ${template.tasks.map((taskName) => {
                        const exists = templateNames.has(taskName);
                        return html`<span
                          class="template-task-chip ${exists ? "linkable" : ""}"
                          @click=${exists
                            ? () => this.navigateToTemplate(taskName)
                            : nothing}
                          >${taskName}</span
                        >`;
                      })}
                    </div>
                  </div>
                </div>
              `
            : nothing}
          ${template.tags && template.tags.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Tags</div>
                  <div class="block-content">
                    ${template.tags.map(
                      (tag) =>
                        html`<span class="tool-badge" style="margin-right:6px"
                          >${tag}</span
                        >`
                    )}
                  </div>
                </div>
              `
            : nothing}
          ${template.skills && template.skills.length > 0
            ? (() => {
                const skillDirs = new Set(
                  (this.skillStore?.skills.get() ?? []).map((sk) => sk.dirName)
                );
                return html`
                  <div class="block">
                    <div class="block-header">Skills</div>
                    <div class="block-content">
                      ${template.skills.map((s) => {
                        const exists = skillDirs.has(s);
                        return html`<span
                          class="identity-chip skill ${exists
                            ? "linkable"
                            : ""}"
                          style="margin-right:6px"
                          @click=${exists
                            ? () => this.navigateToSkill(s)
                            : nothing}
                          >${s}</span
                        >`;
                      })}
                    </div>
                  </div>
                `;
              })()
            : nothing}
          ${template.functions && template.functions.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Functions</div>
                  <div class="block-content">
                    ${template.functions.map(
                      (fn) =>
                        html`<span class="tool-badge" style="margin-right:6px"
                          >${fn}</span
                        >`
                    )}
                  </div>
                </div>
              `
            : nothing}
          ${template.watch_events && template.watch_events.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Listening For</div>
                  <div class="block-content">
                    ${template.watch_events.map(
                      (ev) =>
                        html`<span
                          class="signal-chip"
                          style="margin-right:6px"
                          >${ev.type}</span
                        >`
                    )}
                  </div>
                </div>
              `
            : nothing}
          ${this.renderBacklinks(template.name)}
        </div>
      </div>
    `;
  }

  private renderBacklinks(templateName: string) {
    if (!this.ticketStore) return nothing;
    const usingTickets = this.ticketStore.tickets
      .get()
      .filter(
        (t) => t.kind !== "coordination" && t.playbook_id === templateName
      );
    if (usingTickets.length === 0) return nothing;
    return html`
      <div class="block">
        <div class="block-header">
          Used by Tickets (${usingTickets.length})
        </div>
        <div class="block-content">
          <div class="backlink-list">
            ${usingTickets.map(
              (t) => html`<span
                class="backlink-chip linkable"
                @click=${() => this.navigateToTicket(t.id)}
                >${t.title || t.id.slice(0, 8)}</span
              >`
            )}
          </div>
        </div>
      </div>
    `;
  }

  private navigateToTemplate(name: string) {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { tab: "templates", id: name },
        bubbles: true,
      })
    );
  }

  private navigateToSkill(dirName: string) {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { tab: "skills", id: dirName },
        bubbles: true,
      })
    );
  }

  private navigateToTicket(ticketId: string) {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { tab: "tickets", id: ticketId },
        bubbles: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-template-detail": BeesTemplateDetail;
  }
}
