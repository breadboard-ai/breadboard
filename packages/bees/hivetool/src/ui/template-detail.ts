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

import type { TemplateStore, TemplateData, OptionPropertySchema } from "../data/template-store.js";
import type { SkillStore } from "../data/skill-store.js";
import type { TicketStore } from "../data/ticket-store.js";
import { sharedStyles } from "./shared-styles.js";
import "./truncated-text.js";
import "./primitives/editable-field.js";
import "./primitives/editable-textarea.js";
import "./primitives/chip-input.js";
import "./primitives/edit-controls.js";

export { BeesTemplateDetail };

/** Prebuilt voices available in the Gemini Live API. */
const GEMINI_VOICES = [
  "Kore",
  "Puck",
  "Charon",
  "Aoede",
  "Fenrir",
  "Zephyr",
  "Leda",
  "Orus",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalgethi",
  "Laomedeia",
  "Achernar",
  "Alnilam",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafat",
] as const;

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

      /* ── Run button ── */

      .run-btn {
        padding: 4px 10px;
        font-size: 0.7rem;
        background: #065f4633;
        color: #34d399;
        border: 1px solid #065f46;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      }

      .run-btn:hover {
        color: #6ee7b7;
        border-color: #10b981;
        background: #065f4666;
      }

      /* ── Run dialog overlay ── */

      .run-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        backdrop-filter: blur(4px);
      }

      .run-dialog {
        background: #151822;
        border: 1px solid #1e293b;
        border-radius: 12px;
        padding: 24px;
        min-width: 480px;
        max-width: 600px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      }

      .run-dialog h3 {
        margin: 0 0 4px;
        font-size: 1rem;
        font-weight: 600;
        color: #f8fafc;
      }

      .run-dialog .run-subtitle {
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 16px;
      }

      .run-dialog textarea {
        width: 100%;
        min-height: 120px;
        padding: 10px 12px;
        background: #0b0c0f;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #e2e8f0;
        font-family: inherit;
        font-size: 0.85rem;
        resize: vertical;
        outline: none;
        transition: border-color 0.15s;
      }

      .run-dialog textarea:focus {
        border-color: #10b981;
      }

      .run-dialog textarea::placeholder {
        color: #475569;
      }

      .run-dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }

      .run-dialog-actions button {
        padding: 6px 16px;
        font-size: 0.8rem;
        border-radius: 6px;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s;
      }

      .run-cancel-btn {
        background: transparent;
        color: #94a3b8;
        border: 1px solid #334155;
      }

      .run-cancel-btn:hover {
        color: #e2e8f0;
        border-color: #475569;
      }

      .run-create-btn {
        background: #065f46;
        color: #34d399;
        border: 1px solid #10b981;
        font-weight: 600;
      }

      .run-create-btn:hover {
        background: #047857;
        color: #6ee7b7;
      }

      .run-create-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      /* ── Options schema view block ── */

      .option-row {
        padding: 8px 0;
        border-bottom: 1px solid #1e293b;
      }

      .option-row:last-child {
        border-bottom: none;
      }

      .option-name-line {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .option-name {
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.8rem;
        font-weight: 600;
        color: #e2e8f0;
      }

      .option-type-badge {
        font-size: 0.65rem;
        padding: 1px 6px;
        border-radius: 3px;
        background: #1a1526;
        color: #c4b5fd;
        border: 1px solid #2d2540;
      }

      .option-enum-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-left: auto;
      }

      .option-enum-pill {
        font-size: 0.65rem;
        padding: 1px 6px;
        border-radius: 3px;
        background: #111d1f;
        color: #5eead4;
        border: 1px solid #1a3338;
        font-family: "Google Mono", "Roboto Mono", monospace;
      }

      .option-desc {
        font-size: 0.72rem;
        color: #64748b;
        margin-top: 3px;
        line-height: 1.4;
      }

      /* ── Run dialog options section ── */

      .run-options-section {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #1e293b;
      }

      .run-options-title {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #94a3b8;
        margin-bottom: 10px;
      }

      .run-option-field {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }

      .run-option-label {
        font-size: 0.8rem;
        color: #cbd5e1;
        min-width: 120px;
        font-family: "Google Mono", "Roboto Mono", monospace;
      }

      .run-option-field select,
      .run-option-field input {
        flex: 1;
        padding: 6px 10px;
        background: #0b0c0f;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #e2e8f0;
        font-family: inherit;
        font-size: 0.85rem;
        outline: none;
        transition: border-color 0.15s;
      }

      .run-option-field select:focus,
      .run-option-field input:focus {
        border-color: #10b981;
      }

      /* ── Edit mode options schema editor ── */

      .schema-editor-row {
        display: grid;
        grid-template-columns: 1fr 80px 1fr 1fr 32px;
        gap: 8px;
        align-items: start;
        margin-bottom: 8px;
      }

      .schema-editor-row input {
        width: 100%;
        padding: 6px 8px;
        background: #0b0c0f;
        border: 1px solid #334155;
        border-radius: 4px;
        color: #e2e8f0;
        font-family: inherit;
        font-size: 0.8rem;
        outline: none;
      }

      .schema-editor-row select {
        width: 100%;
        padding: 6px 8px;
        background: #0b0c0f;
        border: 1px solid #334155;
        border-radius: 4px;
        color: #e2e8f0;
        font-family: inherit;
        font-size: 0.8rem;
        outline: none;
      }

      .schema-delete-btn {
        padding: 4px;
        background: transparent;
        color: #64748b;
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
        line-height: 1;
        transition: all 0.15s;
      }

      .schema-delete-btn:hover {
        color: #f87171;
        border-color: #991b1b;
        background: #450a0a;
      }

      .schema-add-btn {
        padding: 4px 12px;
        font-size: 0.75rem;
        background: transparent;
        color: #94a3b8;
        border: 1px dashed #334155;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      }

      .schema-add-btn:hover {
        color: #e2e8f0;
        border-color: #3b82f6;
        background: #1e293b;
      }

      .schema-header-row {
        display: grid;
        grid-template-columns: 1fr 80px 1fr 1fr 32px;
        gap: 8px;
        margin-bottom: 4px;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
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
  @state() accessor saveLocal = false;

  // ── Run state ──
  @state() accessor showRunDialog = false;
  @state() accessor runContext = "";
  @state() accessor runOptions: Record<string, unknown> = {};
  @state() accessor runningTemplate: TemplateData | null = null;

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

    return html`
      ${this.renderViewMode(template)}
      ${this.showRunDialog && this.runningTemplate
        ? this.renderRunDialog(this.runningTemplate)
        : nothing}
    `;
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
    if (template.runner && template.runner !== "generate")
      chips.push({ label: "runner", value: template.runner });
    if (template.voice)
      chips.push({ label: "voice", value: template.voice });

    const allTemplates = this.templateStore!.templates.get();
    const templateNames = new Set(allTemplates.map((t) => t.name));

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${template.title || template.name}</h2>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="run-btn" @click=${() => this.handleRun(template)}>
                ▶ Run
              </button>
              ${this.templateStore!.access.isReadonly.get() ? nothing : html`
              <button class="edit-btn" @click=${() => this.startEditing(template)}>
                ✏️ Edit
              </button>
              `}
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
          ${this.renderOptionsSchemaView(template)}
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
            ${isNew && this.ticketStore?.selectedTicketId.get()
              ? html`
                  <div class="edit-row" style="align-items:center;margin-bottom:8px">
                    <label style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:#cbd5e1;cursor:pointer">
                      <input
                        type="checkbox"
                        ?checked=${this.saveLocal}
                        @change=${(e: Event) => {
                          this.saveLocal = (e.target as HTMLInputElement).checked;
                        }}
                        style="cursor:pointer"
                      />
                      Save as Local Template in Active Task Workspace
                    </label>
                  </div>
                `
              : nothing}
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
              <bees-editable-field
                label="Runner"
                .value=${draft.runner ?? "generate"}
                editing
                placeholder="generate"
                @change=${(e: CustomEvent) => {
                  const val = e.detail.value;
                  this.updateDraft({
                    runner: (val === "live" || val === "direct_model") ? val : "generate",
                  });
                }}
              ></bees-editable-field>
            </div>

            ${draft.runner === "live"
              ? html`
                  <div class="edit-row">
                    <div>
                      <label
                        style="display:block;font-size:0.7rem;color:#94a3b8;margin-bottom:4px"
                        >Voice</label
                      >
                      <select
                        style="
                          width:100%;padding:6px 10px;background:#0b0c0f;
                          border:1px solid #334155;border-radius:6px;
                          color:#e2e8f0;font-family:inherit;font-size:0.85rem;
                          outline:none;
                        "
                        @change=${(e: Event) => {
                          const val = (e.target as HTMLSelectElement).value;
                          this.updateDraft({ voice: val || undefined });
                        }}
                      >
                        <option value="" ?selected=${!draft.voice}>
                          Default (Kore)
                        </option>
                        ${GEMINI_VOICES.map(
                          (v) => html`
                            <option value=${v} ?selected=${draft.voice === v}>
                              ${v}
                            </option>
                          `
                        )}
                      </select>
                    </div>
                  </div>
                `
              : nothing}

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

            ${this.renderOptionsSchemaEditor(draft)}
          </div>
        </div>
      </div>
    `;
  }

  // ── Edit actions ──

  private startEditing(template: TemplateData) {
    this.#originalName = template.name;
    this.draft = { ...template };
    this.saveLocal = !!template.isWorkspaceScoped;
    this.editing = true;
    this.error = null;
  }

  startCreating() {
    this.#originalName = null;
    this.draft = { name: "" };
    this.saveLocal = false;
    this.creating = true;
    this.editing = false;
    this.error = null;
  }

  /** Whether the component is currently in edit/create mode. */
  get isEditing(): boolean {
    return this.editing || this.creating;
  }

  /** Whether there are unsaved changes. */
  get hasDirtyEdits(): boolean {
    return this.isEditing && this.isDirty();
  }

  /** Programmatically trigger a save (e.g. from Cmd+S). */
  triggerSave() {
    if (this.isEditing && this.isDirty()) this.handleSave();
  }

  cancelEditing() {
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

    const activeTicketId = this.ticketStore?.selectedTicketId.get();

    try {
      if (this.creating) {
        await this.templateStore.createTemplate(this.draft, activeTicketId, this.saveLocal);
      } else if (this.#originalName) {
        await this.templateStore.saveTemplate(this.#originalName, this.draft, activeTicketId);
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

    const activeTicketId = this.ticketStore?.selectedTicketId.get();

    try {
      await this.templateStore.deleteTemplate(this.#originalName, activeTicketId);
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

  // ── Run from template ──

  /** Whether the template objective uses {{system.context}}. */
  private needsContext(template: TemplateData): boolean {
    return (template.objective ?? "").includes("{{system.context}}");
  }

  /** Whether the template declares options_schema. */
  private hasOptions(template: TemplateData): boolean {
    return Object.keys(template.options_schema ?? {}).length > 0;
  }

  /**
   * Initiate a run from a template. If the template needs context,
   * show the dialog; otherwise create the task immediately.
   */
  private handleRun(template: TemplateData) {
    if (this.needsContext(template) || this.hasOptions(template)) {
      this.runningTemplate = template;
      this.runContext = "";
      this.runOptions = {};
      this.showRunDialog = true;
    } else {
      this.executeRun(template, undefined);
    }
  }

  private closeRunDialog() {
    this.showRunDialog = false;
    this.runningTemplate = null;
    this.runContext = "";
    this.runOptions = {};
  }

  private renderRunDialog(template: TemplateData) {
    const wantsContext = this.needsContext(template);
    const schema = template.options_schema ?? {};
    const schemaEntries = Object.entries(schema);
    const canCreate = !wantsContext || this.runContext.trim();

    return html`
      <div class="run-overlay" @click=${(e: Event) => {
        if (e.target === e.currentTarget) this.closeRunDialog();
      }}>
        <div class="run-dialog">
          <h3>▶ Run: ${template.title || template.name}</h3>
          ${wantsContext
            ? html`
              <div class="run-subtitle">
                This template requires context to run.
              </div>
              <textarea
                placeholder="Provide context for {{system.context}}…"
                .value=${this.runContext}
                @input=${(e: Event) => {
                  this.runContext = (e.target as HTMLTextAreaElement).value;
                }}
              ></textarea>
            `
            : html`
              <div class="run-subtitle">
                Configure options and create the task.
              </div>
            `}
          ${schemaEntries.length > 0
            ? html`
              <div class="run-options-section">
                <div class="run-options-title">Options</div>
                ${schemaEntries.map(([key, prop]) =>
                  this.renderRunOptionField(key, prop)
                )}
              </div>
            `
            : nothing}
          <div class="run-dialog-actions">
            <button
              class="run-cancel-btn"
              @click=${() => this.closeRunDialog()}
            >Cancel</button>
            <button
              class="run-create-btn"
              ?disabled=${!canCreate}
              @click=${() => {
                const options = this.collectRunOptions();
                this.executeRun(
                  template,
                  wantsContext ? this.runContext.trim() : undefined,
                  options,
                );
                this.closeRunDialog();
              }}
            >Create Task</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create a task on disk from a template.
   * Writes objective.md + metadata.json so the box picks it up.
   */
  /**
   * Render a single form control for an option in the run dialog.
   */
  private renderRunOptionField(key: string, prop: OptionPropertySchema) {
    const label = key.replace(/_/g, " ");

    if (prop.enum && prop.enum.length > 0) {
      return html`
        <div class="run-option-field">
          <span class="run-option-label">${label}</span>
          <select
            @change=${(e: Event) => {
              const val = (e.target as HTMLSelectElement).value;
              this.runOptions = { ...this.runOptions, [key]: val || undefined };
            }}
          >
            <option value="" selected>Default</option>
            ${prop.enum.map((v) => html`<option value=${v}>${v}</option>`)}
          </select>
        </div>
      `;
    }

    if (prop.type === "number") {
      return html`
        <div class="run-option-field">
          <span class="run-option-label">${label}</span>
          <input
            type="number"
            placeholder=${prop.description ?? ""}
            @input=${(e: Event) => {
              const raw = (e.target as HTMLInputElement).value;
              this.runOptions = {
                ...this.runOptions,
                [key]: raw ? Number(raw) : undefined,
              };
            }}
          />
        </div>
      `;
    }

    return html`
      <div class="run-option-field">
        <span class="run-option-label">${label}</span>
        <input
          type="text"
          placeholder=${prop.description ?? ""}
          @input=${(e: Event) => {
            const val = (e.target as HTMLInputElement).value;
            this.runOptions = {
              ...this.runOptions,
              [key]: val || undefined,
            };
          }}
        />
      </div>
    `;
  }

  /** Collect non-empty run options into a clean dict. */
  private collectRunOptions(): Record<string, unknown> | undefined {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.runOptions)) {
      if (v !== undefined && v !== "") clean[k] = v;
    }
    return Object.keys(clean).length > 0 ? clean : undefined;
  }

  private async executeRun(
    template: TemplateData,
    context: string | undefined,
    options?: Record<string, unknown>,
  ) {
    if (!this.ticketStore) return;

    try {
      const taskId = await this.ticketStore.createTask({
        objective: template.objective ?? "",
        playbook_id: template.name,
        title: template.title,
        functions: template.functions,
        skills: template.skills,
        tags: template.tags,
        tasks: template.tasks,
        model: template.model,
        runner: template.runner,
        context,
        watch_events: template.watch_events,
        options,
      });

      // Navigate to the new task.
      this.dispatchEvent(
        new CustomEvent("navigate", {
          detail: { tab: "tickets", id: taskId },
          bubbles: true,
        })
      );
    } catch (e) {
      console.error("Failed to create task from template:", e);
      this.error =
        e instanceof Error ? e.message : "Failed to create task.";
    }
  }

  // ── View mode: options schema rendering ──

  private renderOptionsSchemaView(template: TemplateData) {
    const schema = template.options_schema;
    if (!schema || Object.keys(schema).length === 0) return nothing;

    return html`
      <div class="block">
        <div class="block-header">Configuration Options</div>
        <div class="block-content">
          ${Object.entries(schema).map(
            ([key, prop]) => html`
              <div class="option-row">
                <div class="option-name-line">
                  <span class="option-name">${key}</span>
                  <span class="option-type-badge">${prop.type}</span>
                  ${prop.enum && prop.enum.length > 0
                    ? html`
                        <div class="option-enum-pills">
                          ${prop.enum.map(
                            (v) =>
                              html`<span class="option-enum-pill"
                                >${v}</span
                              >`
                          )}
                        </div>
                      `
                    : nothing}
                </div>
                ${prop.description
                  ? html`<div class="option-desc">${prop.description}</div>`
                  : nothing}
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  // ── Edit mode: options schema editor ──

  private renderOptionsSchemaEditor(draft: TemplateData) {
    const schema = draft.options_schema ?? {};
    const entries = Object.entries(schema);

    return html`
      <div class="block" style="border:none;background:transparent">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <label style="font-size:0.7rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.05em"
            >Options Schema</label
          >
          <button
            class="schema-add-btn"
            @click=${() => this.addSchemaOption()}
          >+ Add Option</button>
        </div>
        ${entries.length > 0
          ? html`
            <div class="schema-header-row">
              <span>Name</span>
              <span>Type</span>
              <span>Description</span>
              <span>Enum Values</span>
              <span></span>
            </div>
            ${entries.map(([key, prop], i) =>
              this.renderSchemaEditorRow(key, prop, i)
            )}
          `
          : html`<div style="font-size:0.75rem;color:#475569;padding:8px 0">No options defined. Click "+ Add Option" to start.</div>`}
      </div>
    `;
  }

  private renderSchemaEditorRow(
    key: string,
    prop: OptionPropertySchema,
    _index: number,
  ) {
    return html`
      <div class="schema-editor-row">
        <input
          type="text"
          .value=${key}
          placeholder="option_name"
          @change=${(e: Event) => {
            const newKey = (e.target as HTMLInputElement).value.trim();
            if (newKey && newKey !== key) {
              this.renameSchemaOption(key, newKey);
            }
          }}
        />
        <select
          @change=${(e: Event) => {
            const val = (e.target as HTMLSelectElement).value;
            this.updateSchemaOption(key, { ...prop, type: val });
          }}
        >
          <option value="string" ?selected=${prop.type === "string"}>string</option>
          <option value="number" ?selected=${prop.type === "number"}>number</option>
        </select>
        <input
          type="text"
          .value=${prop.description ?? ""}
          placeholder="Description…"
          @change=${(e: Event) => {
            const val = (e.target as HTMLInputElement).value;
            this.updateSchemaOption(key, {
              ...prop,
              description: val || undefined,
            });
          }}
        />
        <input
          type="text"
          .value=${(prop.enum ?? []).join(", ")}
          placeholder="value1, value2, …"
          @change=${(e: Event) => {
            const raw = (e.target as HTMLInputElement).value;
            const values = raw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((s) => (prop.type === "number" ? Number(s) : s));
            this.updateSchemaOption(key, {
              ...prop,
              enum: values.length > 0 ? values : undefined,
            });
          }}
        />
        <button
          class="schema-delete-btn"
          title="Remove option"
          @click=${() => this.deleteSchemaOption(key)}
        >✕</button>
      </div>
    `;
  }

  private addSchemaOption() {
    if (!this.draft) return;
    const schema = { ...(this.draft.options_schema ?? {}) };
    // Generate a unique placeholder key.
    let n = 1;
    while (schema[`option_${n}`]) n++;
    schema[`option_${n}`] = { type: "string" };
    this.updateDraft({ options_schema: schema });
  }

  private deleteSchemaOption(key: string) {
    if (!this.draft) return;
    const schema = { ...(this.draft.options_schema ?? {}) };
    delete schema[key];
    this.updateDraft({
      options_schema: Object.keys(schema).length > 0 ? schema : undefined,
    });
  }

  private updateSchemaOption(key: string, prop: OptionPropertySchema) {
    if (!this.draft) return;
    const schema = { ...(this.draft.options_schema ?? {}) };
    schema[key] = prop;
    this.updateDraft({ options_schema: schema });
  }

  private renameSchemaOption(oldKey: string, newKey: string) {
    if (!this.draft) return;
    const oldSchema = this.draft.options_schema ?? {};
    const schema: Record<string, OptionPropertySchema> = {};
    for (const [k, v] of Object.entries(oldSchema)) {
      schema[k === oldKey ? newKey : k] = v;
    }
    this.updateDraft({ options_schema: schema });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-template-detail": BeesTemplateDetail;
  }
}
