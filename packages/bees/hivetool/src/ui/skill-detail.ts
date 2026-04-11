/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Detail panel for a selected skill.
 *
 * Supports **view mode** (read-only rendering of frontmatter, body, and
 * backlinks) and **edit mode** (inline editing of all fields via the
 * editable primitives).
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { SkillStore, SkillData } from "../data/skill-store.js";
import type { TemplateStore } from "../data/template-store.js";
import type { TicketStore } from "../data/ticket-store.js";
import { sharedStyles } from "./shared-styles.js";
import "./truncated-text.js";
import "./primitives/editable-field.js";
import "./primitives/editable-textarea.js";
import "./primitives/chip-input.js";
import "./primitives/edit-controls.js";

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

      /* Edit mode styles */
      .edit-btn {
        padding: 4px 10px;
        font-size: 0.7rem;
        background: transparent;
        color: #94a3b8;
        border: 1px solid #334155;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      }

      .edit-btn:hover {
        color: #e2e8f0;
        border-color: #3b82f6;
        background: #1e293b;
      }

      .edit-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .edit-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .edit-controls-bar {
        position: sticky;
        top: 0;
        z-index: 11;
        padding: 8px 0;
        background: #0b0c0f;
        border-bottom: 1px solid #1e293b;
      }

      .error-banner {
        padding: 8px 12px;
        background: #450a0a;
        border: 1px solid #991b1b;
        border-radius: 6px;
        color: #fca5a5;
        font-size: 0.8rem;
      }
    `,
  ];

  @property({ attribute: false })
  accessor skillStore: SkillStore | null = null;

  @property({ attribute: false })
  accessor templateStore: TemplateStore | null = null;

  @property({ attribute: false })
  accessor ticketStore: TicketStore | null = null;

  // ── Edit state ──
  @state() accessor editing = false;
  @state() accessor creating = false;
  @state() accessor saving = false;
  @state() accessor error: string | null = null;
  @state() accessor draft: SkillData | null = null;
  @state() accessor draftDirName = "";

  /** The dirName when editing started (for rename detection). */
  #originalDirName: string | null = null;

  render() {
    if (!this.skillStore) return nothing;

    if (this.creating && this.draft) {
      return this.renderEditMode(this.draft, true);
    }

    const skill = this.skillStore.selectedSkill.get();
    if (!skill)
      return html`<div class="empty-state">
        Select a skill to view details
      </div>`;

    if (this.editing && this.draft) {
      return this.renderEditMode(this.draft, false);
    }

    return this.renderViewMode(skill);
  }

  // ── View Mode ──

  private renderViewMode(skill: SkillData) {
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
            <div style="display:flex;align-items:center;gap:8px">
              <button class="edit-btn" @click=${() => this.startEditing(skill)}>
                ✏️ Edit
              </button>
              <div class="skill-badge">SKILL</div>
            </div>
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

  // ── Edit Mode ──

  private renderEditMode(draft: SkillData, isNew: boolean) {
    const isDirty = this.isDirty();

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">
              ${isNew ? "New Skill" : `Editing: ${draft.title || draft.name}`}
            </h2>
            <div class="skill-badge">${isNew ? "NEW" : "EDITING"}</div>
          </div>
        </div>

        <div class="timeline">
          <div class="edit-controls-bar">
            <bees-edit-controls
              ?dirty=${isDirty}
              ?saving=${this.saving}
              ?show-delete=${!isNew}
              @save=${() => this.handleSave()}
              @cancel=${() => this.cancelEditing()}
              @delete=${() => this.handleDelete()}
            ></bees-edit-controls>
          </div>

          ${this.error
            ? html`<div class="error-banner">${this.error}</div>`
            : nothing}

          <div class="edit-form">
            <!-- Identity fields -->
            <div class="edit-row">
              <bees-editable-field
                label="Directory Name"
                .value=${isNew ? this.draftDirName : draft.dirName}
                ?editing=${isNew}
                placeholder="skill-dir-name"
                @change=${(e: CustomEvent) => {
                  this.draftDirName = e.detail.value;
                }}
              ></bees-editable-field>
              <bees-editable-field
                label="Name (frontmatter)"
                .value=${draft.name}
                editing
                placeholder="skill-name"
                @change=${(e: CustomEvent) =>
                  this.updateDraft({ name: e.detail.value })}
              ></bees-editable-field>
            </div>

            <bees-editable-field
              label="Title"
              .value=${draft.title ?? ""}
              editing
              placeholder="Human-readable title"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ title: e.detail.value })}
            ></bees-editable-field>

            <bees-editable-textarea
              label="Description"
              .value=${draft.description ?? ""}
              editing
              min-height="60"
              placeholder="Short summary"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ description: e.detail.value })}
            ></bees-editable-textarea>

            <!-- Allowed tools -->
            <bees-chip-input
              label="Allowed Tools"
              .items=${draft.allowedTools}
              editing
              add-placeholder="e.g. chat.*"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ allowedTools: e.detail.items })}
            ></bees-chip-input>

            <!-- Body (markdown) -->
            <bees-editable-textarea
              label="Content (Markdown)"
              .value=${draft.body}
              editing
              monospace
              min-height="400"
              placeholder="Skill instructions…"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ body: e.detail.value })}
            ></bees-editable-textarea>
          </div>
        </div>
      </div>
    `;
  }

  // ── Edit actions ──

  private startEditing(skill: SkillData) {
    this.#originalDirName = skill.dirName;
    this.draft = { ...skill };
    this.draftDirName = skill.dirName;
    this.editing = true;
    this.error = null;
  }

  startCreating() {
    this.#originalDirName = null;
    this.draft = {
      dirName: "",
      name: "",
      allowedTools: [],
      body: "",
    };
    this.draftDirName = "";
    this.creating = true;
    this.editing = false;
    this.error = null;
  }

  private cancelEditing() {
    this.editing = false;
    this.creating = false;
    this.draft = null;
    this.#originalDirName = null;
    this.error = null;
  }

  private updateDraft(partial: Partial<SkillData>) {
    if (!this.draft) return;
    this.draft = { ...this.draft, ...partial };
  }

  private isDirty(): boolean {
    if (!this.draft) return false;
    if (this.creating)
      return this.draftDirName.trim() !== "" || this.draft.name.trim() !== "";
    if (!this.#originalDirName || !this.skillStore) return false;
    const original = this.skillStore.skills
      .get()
      .find((s) => s.dirName === this.#originalDirName);
    if (!original) return true;
    return JSON.stringify(original) !== JSON.stringify(this.draft);
  }

  private async handleSave() {
    if (!this.draft || !this.skillStore) return;

    const dirName = this.creating
      ? this.draftDirName.trim()
      : this.draft.dirName;
    const name = this.draft.name.trim();

    if (!dirName) {
      this.error = "Directory name is required.";
      return;
    }
    if (!name) {
      this.error = "Name is required.";
      return;
    }

    this.saving = true;
    this.error = null;

    try {
      if (this.creating) {
        await this.skillStore.createSkill(dirName, {
          ...this.draft,
          dirName,
          name,
        });
      } else if (this.#originalDirName) {
        await this.skillStore.saveSkill(this.#originalDirName, this.draft);
      }

      const controls = this.shadowRoot?.querySelector("bees-edit-controls");
      if (controls) (controls as { flashSaved(): void }).flashSaved();

      this.#originalDirName = dirName;
      this.creating = false;
      this.editing = false;
      this.draft = null;
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : "Save failed. Check console.";
      console.error("Skill save error:", e);
    } finally {
      this.saving = false;
    }
  }

  private async handleDelete() {
    if (!this.skillStore || !this.#originalDirName) return;

    this.saving = true;
    this.error = null;

    try {
      await this.skillStore.deleteSkill(this.#originalDirName);
      this.cancelEditing();
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : "Delete failed. Check console.";
      console.error("Skill delete error:", e);
    } finally {
      this.saving = false;
    }
  }

  // ── Backlinks ──

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

  // ── Navigation ──

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
