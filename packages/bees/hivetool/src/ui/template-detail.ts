/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Detail panel for a selected template.
 *
 * Supports **view mode** (read-only rendering) and **edit mode** (inline
 * editing via the editable primitives). Composes `<bees-editable-field>`,
 * `<bees-editable-textarea>`, `<bees-chip-input>`, and
 * `<bees-edit-controls>` for editing.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { TemplateStore, TemplateData } from "../data/template-store.js";
import type { SkillStore } from "../data/skill-store.js";
import type { TicketStore } from "../data/ticket-store.js";
import { sharedStyles } from "./shared-styles.js";
import "./truncated-text.js";
import "./primitives/editable-field.js";
import "./primitives/editable-textarea.js";
import "./primitives/chip-input.js";
import "./primitives/edit-controls.js";

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
  accessor templateStore: TemplateStore | null = null;

  @property({ attribute: false })
  accessor skillStore: SkillStore | null = null;

  @property({ attribute: false })
  accessor ticketStore: TicketStore | null = null;

  // ── Edit state ──
  @state() accessor editing = false;
  @state() accessor creating = false;
  @state() accessor saving = false;
  @state() accessor error: string | null = null;
  @state() accessor draft: TemplateData | null = null;

  /** The name of the template when editing started (for rename detection). */
  #originalName: string | null = null;

  render() {
    if (!this.templateStore) return nothing;

    // Creating a new template — show edit form with empty draft.
    if (this.creating && this.draft) {
      return this.renderEditMode(this.draft, true);
    }

    const template = this.templateStore.selectedTemplate.get();
    if (!template)
      return html`<div class="empty-state">
        Select a template to view details
      </div>`;

    if (this.editing && this.draft) {
      return this.renderEditMode(this.draft, false);
    }

    return this.renderViewMode(template);
  }

  // ── View Mode ──

  private renderViewMode(template: TemplateData) {
    const chips: Array<{
      label: string;
      value: string;
      cls?: string;
      onclick?: () => void;
    }> = [];
    chips.push({ label: "name", value: template.name, cls: "playbook" });
    if (template.model)
      chips.push({ label: "model", value: template.model, cls: "model" });

    const allTemplates = this.templateStore!.templates.get();
    const templateNames = new Set(allTemplates.map((t) => t.name));

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${template.title || template.name}</h2>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="edit-btn" @click=${() => this.startEditing(template)}>
                ✏️ Edit
              </button>
              <div class="template-badge">TEMPLATE</div>
            </div>
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
          ${template.autostart && template.autostart.length > 0
            ? html`
                <div class="block">
                  <div class="block-header">Autostart</div>
                  <div class="block-content">
                    <div class="template-tasks-list">
                      ${template.autostart.map((name) => {
                        const exists = templateNames.has(name);
                        return html`<span
                          class="template-task-chip ${exists ? "linkable" : ""}"
                          @click=${exists
                            ? () => this.navigateToTemplate(name)
                            : nothing}
                          >${name}</span
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

  // ── Edit Mode ──

  private renderEditMode(draft: TemplateData, isNew: boolean) {
    const allTemplates = this.templateStore!.templates.get();
    const templateNames = allTemplates.map((t) => t.name);
    const skillNames = (this.skillStore?.skills.get() ?? []).map(
      (s) => s.dirName
    );

    const isDirty = this.isDirty();

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">
              ${isNew ? "New Template" : `Editing: ${draft.title || draft.name}`}
            </h2>
            <div class="template-badge">
              ${isNew ? "NEW" : "EDITING"}
            </div>
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
                label="Name (identifier)"
                .value=${draft.name}
                ?editing=${isNew}
                placeholder="template-name"
                @change=${(e: CustomEvent) =>
                  this.updateDraft({ name: e.detail.value })}
              ></bees-editable-field>
              <bees-editable-field
                label="Title"
                .value=${draft.title ?? ""}
                editing
                placeholder="Human-readable title"
                @change=${(e: CustomEvent) =>
                  this.updateDraft({ title: e.detail.value })}
              ></bees-editable-field>
            </div>

            <bees-editable-textarea
              label="Description"
              .value=${draft.description ?? ""}
              editing
              min-height="60"
              placeholder="Short summary"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ description: e.detail.value })}
            ></bees-editable-textarea>

            <div class="edit-row">
              <bees-editable-field
                label="Model"
                .value=${draft.model ?? ""}
                editing
                placeholder="e.g. gemini-3.1-pro-preview"
                @change=${(e: CustomEvent) =>
                  this.updateDraft({ model: e.detail.value })}
              ></bees-editable-field>
            </div>

            <!-- Objective -->
            <bees-editable-textarea
              label="Objective"
              .value=${draft.objective ?? ""}
              editing
              min-height="200"
              placeholder="Agent instructions…"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ objective: e.detail.value })}
            ></bees-editable-textarea>

            <!-- List fields -->
            <bees-chip-input
              label="Skills"
              .items=${draft.skills ?? []}
              editing
              .suggestions=${skillNames}
              add-placeholder="Add skill…"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ skills: e.detail.items })}
            ></bees-chip-input>

            <bees-chip-input
              label="Subtask Templates (tasks)"
              .items=${draft.tasks ?? []}
              editing
              .suggestions=${templateNames}
              add-placeholder="Add template…"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ tasks: e.detail.items })}
            ></bees-chip-input>

            <bees-chip-input
              label="Autostart"
              .items=${draft.autostart ?? []}
              editing
              .suggestions=${templateNames}
              add-placeholder="Add template…"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ autostart: e.detail.items })}
            ></bees-chip-input>

            <bees-chip-input
              label="Functions"
              .items=${draft.functions ?? []}
              editing
              add-placeholder="e.g. system.*"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ functions: e.detail.items })}
            ></bees-chip-input>

            <bees-chip-input
              label="Tags"
              .items=${draft.tags ?? []}
              editing
              add-placeholder="Add tag…"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ tags: e.detail.items })}
            ></bees-chip-input>

            <bees-chip-input
              label="Watch Events"
              .items=${(draft.watch_events ?? []).map((ev) => ev.type)}
              editing
              add-placeholder="e.g. digest_ready"
              @change=${(e: CustomEvent) =>
                this.updateDraft({
                  watch_events: (e.detail.items as string[]).map(
                    (type: string) => ({ type })
                  ),
                })}
            ></bees-chip-input>
          </div>
        </div>
      </div>
    `;
  }

  // ── Edit actions ──

  private startEditing(template: TemplateData) {
    this.#originalName = template.name;
    this.draft = { ...template };
    this.editing = true;
    this.error = null;
  }

  startCreating() {
    this.#originalName = null;
    this.draft = { name: "" };
    this.creating = true;
    this.editing = false;
    this.error = null;
  }

  private cancelEditing() {
    this.editing = false;
    this.creating = false;
    this.draft = null;
    this.#originalName = null;
    this.error = null;
  }

  private updateDraft(partial: Partial<TemplateData>) {
    if (!this.draft) return;
    this.draft = { ...this.draft, ...partial };
  }

  private isDirty(): boolean {
    if (!this.draft) return false;
    if (this.creating) return this.draft.name.trim() !== "";
    if (!this.#originalName || !this.templateStore) return false;
    const original = this.templateStore.templates
      .get()
      .find((t) => t.name === this.#originalName);
    if (!original) return true;
    return JSON.stringify(original) !== JSON.stringify(this.draft);
  }

  private async handleSave() {
    if (!this.draft || !this.templateStore) return;

    // Validate name.
    const name = this.draft.name.trim();
    if (!name) {
      this.error = "Name is required.";
      return;
    }

    this.saving = true;
    this.error = null;

    try {
      if (this.creating) {
        await this.templateStore.createTemplate(this.draft);
      } else if (this.#originalName) {
        await this.templateStore.saveTemplate(this.#originalName, this.draft);
        // If name changed, update selection.
        if (this.draft.name !== this.#originalName) {
          this.templateStore.selectTemplate(this.draft.name);
        }
      }

      // Flash "Saved ✓".
      const controls = this.shadowRoot?.querySelector("bees-edit-controls");
      if (controls) (controls as { flashSaved(): void }).flashSaved();

      this.#originalName = this.draft.name;
      this.creating = false;
      this.editing = false;
      this.draft = null;
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : "Save failed. Check console.";
      console.error("Template save error:", e);
    } finally {
      this.saving = false;
    }
  }

  private async handleDelete() {
    if (!this.templateStore || !this.#originalName) return;

    this.saving = true;
    this.error = null;

    try {
      await this.templateStore.deleteTemplate(this.#originalName);
      this.cancelEditing();
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : "Delete failed. Check console.";
      console.error("Template delete error:", e);
    } finally {
      this.saving = false;
    }
  }

  // ── Backlinks ──

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

  // ── Navigation ──

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
