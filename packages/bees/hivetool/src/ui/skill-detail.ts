/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Detail panel for a selected skill.
 *
 * Renders frontmatter metadata (name, title, description, allowed-tools),
 * the full markdown body, and backlinks to templates and tickets that
 * reference this skill.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { SkillStore } from "../data/skill-store.js";
import type { TemplateStore } from "../data/template-store.js";
import type { TicketStore } from "../data/ticket-store.js";
import { sharedStyles } from "./shared-styles.js";
import "./truncated-text.js";

export { BeesSkillDetail };

@customElement("bees-skill-detail")
class BeesSkillDetail extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      .skill-badge {
        font-size: 0.65rem;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: #1e3a8a22;
        color: #93c5fd;
        border: 1px solid #1e3a5c;
      }
    `,
  ];

  @property({ attribute: false })
  accessor skillStore: SkillStore | null = null;

  @property({ attribute: false })
  accessor templateStore: TemplateStore | null = null;

  @property({ attribute: false })
  accessor ticketStore: TicketStore | null = null;

  render() {
    if (!this.skillStore) return nothing;
    const skill = this.skillStore.selectedSkill.get();
    if (!skill)
      return html`<div class="empty-state">
        Select a skill to view details
      </div>`;

    // Build identity chips.
    const chips: Array<{
      label: string;
      value: string;
      cls?: string;
    }> = [];
    chips.push({ label: "name", value: skill.name, cls: "skill" });
    if (skill.dirName !== skill.name)
      chips.push({ label: "dir", value: skill.dirName });

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${skill.title || skill.name}</h2>
            <div class="skill-badge">SKILL</div>
          </div>
          ${skill.description
            ? html`<div class="job-detail-meta">
                <span>${skill.description}</span>
              </div>`
            : nothing}
        </div>

        <div class="timeline">
          ${chips.length > 0
            ? html`
                <div class="identity-row">
                  ${chips.map(
                    (c) => html`
                      <span class="identity-chip ${c.cls ?? ""}">
                        <span class="identity-label">${c.label}</span>
                        ${c.value}
                      </span>
                    `
                  )}
                </div>
              `
            : nothing}
          ${skill.allowedTools.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Allowed Tools</div>
                  <div class="block-content">
                    ${skill.allowedTools.map(
                      (t) =>
                        html`<span class="tool-badge" style="margin-right:6px"
                          >${t}</span
                        >`
                    )}
                  </div>
                </div>
              `
            : nothing}
          <div class="block">
            <div class="block-header">Content</div>
            <div class="block-content">
              <bees-truncated-text
                threshold="800"
                max-height="500"
                fadeBg="#0f1115"
                >${skill.body}</bees-truncated-text
              >
            </div>
          </div>
          ${this.renderTemplateBacklinks(skill.dirName)}
          ${this.renderTicketBacklinks(skill.dirName)}
        </div>
      </div>
    `;
  }

  private renderTemplateBacklinks(dirName: string) {
    if (!this.templateStore) return nothing;
    const usingTemplates = this.templateStore.templates
      .get()
      .filter((t) => t.skills?.includes(dirName));
    if (usingTemplates.length === 0) return nothing;
    return html`
      <div class="block">
        <div class="block-header">
          Used by Templates (${usingTemplates.length})
        </div>
        <div class="block-content">
          <div class="backlink-list">
            ${usingTemplates.map(
              (t) => html`<span
                class="backlink-chip linkable"
                @click=${() => this.navigateToTemplate(t.name)}
                >${t.title || t.name}</span
              >`
            )}
          </div>
        </div>
      </div>
    `;
  }

  private renderTicketBacklinks(dirName: string) {
    if (!this.ticketStore) return nothing;
    const usingTickets = this.ticketStore.tickets
      .get()
      .filter(
        (t) => t.kind !== "coordination" && t.skills?.includes(dirName)
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
    "bees-skill-detail": BeesSkillDetail;
  }
}
