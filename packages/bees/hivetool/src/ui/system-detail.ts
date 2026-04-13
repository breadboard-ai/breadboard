/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Detail panel for the hive system configuration.
 *
 * Displays the three SYSTEM.yaml fields (title, description, root) in
 * view mode, with inline editing via the editable primitives. Implements
 * the `EditablePanel` interface so `app.ts` can guard tab switches and
 * wire Cmd+S / Escape.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { SystemStore, SystemData } from "../data/system-store.js";
import type { TemplateStore } from "../data/template-store.js";
import { sharedStyles } from "./shared-styles.js";
import "./primitives/editable-field.js";
import "./primitives/editable-textarea.js";
import "./primitives/edit-controls.js";

export { BeesSystemDetail };

@customElement("bees-system-detail")
class BeesSystemDetail extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      .system-badge {
        font-size: 0.65rem;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: #7c3aed22;
        color: #a78bfa;
        border: 1px solid #7c3aed55;
      }

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

      .root-link {
        cursor: pointer;
        transition: color 0.15s;
      }

      .root-link:hover {
        color: #93c5fd;
      }
    `,
  ];

  @property({ attribute: false })
  accessor systemStore: SystemStore | null = null;

  @property({ attribute: false })
  accessor templateStore: TemplateStore | null = null;

  // ── Edit state ──
  @state() accessor editing = false;
  @state() accessor saving = false;
  @state() accessor error: string | null = null;
  @state() accessor draft: SystemData | null = null;

  #original: SystemData | null = null;

  render() {
    if (!this.systemStore) return nothing;

    const config = this.systemStore.config.get();

    if (this.editing && this.draft) {
      return this.renderEditMode(this.draft);
    }

    return this.renderViewMode(config);
  }

  // ── View Mode ──

  private renderViewMode(config: SystemData) {
    const rootExists =
      this.templateStore
        ?.templates.get()
        .some((t) => t.name === config.root) ?? false;

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${config.title || "Untitled Hive"}</h2>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="edit-btn" @click=${() => this.startEditing(config)}>
                ✏️ Edit
              </button>
              <div class="system-badge">SYSTEM</div>
            </div>
          </div>
          ${config.description
            ? html`<div class="job-detail-meta">
                <span>${config.description}</span>
              </div>`
            : nothing}
        </div>

        <div class="timeline">
          <div class="identity-row">
            <span class="identity-chip playbook">
              <span class="identity-label">title</span>
              ${config.title || "—"}
            </span>
          </div>

          <div class="block">
            <div class="block-header">Description</div>
            <div class="block-content">
              ${config.description || html`<span style="color:#475569;font-style:italic">No description</span>`}
            </div>
          </div>

          <div class="block">
            <div class="block-header">Root Template</div>
            <div class="block-content">
              <span
                class="identity-chip playbook ${rootExists ? "linkable" : ""}"
                @click=${rootExists
                  ? () => this.navigateToTemplate(config.root)
                  : nothing}
              >
                <span class="identity-label">root</span>
                ${config.root || "—"}
              </span>
              ${config.root && !rootExists
                ? html`<span style="color:#f59e0b;font-size:0.75rem;margin-left:8px">
                    ⚠ template not found
                  </span>`
                : nothing}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Edit Mode ──

  private renderEditMode(draft: SystemData) {
    const isDirty = this.isDirty();
    const templateNames = (this.templateStore?.templates.get() ?? []).map(
      (t) => t.name
    );

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">
              Editing: System Configuration
            </h2>
            <div class="system-badge">EDITING</div>
          </div>
        </div>

        <div class="timeline">
          <div class="edit-controls-bar">
            <bees-edit-controls
              ?dirty=${isDirty}
              ?saving=${this.saving}
              @save=${() => this.handleSave()}
              @cancel=${() => this.cancelEditing()}
            ></bees-edit-controls>
          </div>

          ${this.error
            ? html`<div class="error-banner">${this.error}</div>`
            : nothing}

          <div class="edit-form">
            <bees-editable-field
              label="Title"
              .value=${draft.title}
              editing
              placeholder="Hive display name"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ title: e.detail.value })}
            ></bees-editable-field>

            <bees-editable-textarea
              label="Description"
              .value=${draft.description}
              editing
              min-height="60"
              placeholder="Short summary shown in UI"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ description: e.detail.value })}
            ></bees-editable-textarea>

            <bees-editable-field
              label="Root Template"
              .value=${draft.root}
              editing
              placeholder="Template name to auto-boot at startup"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ root: e.detail.value })}
            ></bees-editable-field>

            ${templateNames.length > 0
              ? html`
                  <div style="font-size:0.75rem;color:#64748b">
                    Available templates:
                    ${templateNames.map(
                      (name) => html`
                        <span
                          class="identity-chip playbook linkable"
                          style="font-size:0.7rem;margin:2px"
                          @click=${() => this.updateDraft({ root: name })}
                        >${name}</span>
                      `
                    )}
                  </div>
                `
              : nothing}
          </div>
        </div>
      </div>
    `;
  }

  // ── Edit actions ──

  private startEditing(config: SystemData) {
    this.#original = { ...config };
    this.draft = { ...config };
    this.editing = true;
    this.error = null;
  }

  /** Whether the component is currently in edit mode. */
  get isEditing(): boolean {
    return this.editing;
  }

  /** Whether there are unsaved changes. */
  get hasDirtyEdits(): boolean {
    return this.editing && this.isDirty();
  }

  /** Programmatically trigger a save (e.g. from Cmd+S). */
  triggerSave() {
    if (this.editing && this.isDirty()) this.handleSave();
  }

  cancelEditing() {
    this.editing = false;
    this.draft = null;
    this.#original = null;
    this.error = null;
  }

  private updateDraft(partial: Partial<SystemData>) {
    if (!this.draft) return;
    this.draft = { ...this.draft, ...partial };
  }

  private isDirty(): boolean {
    if (!this.draft || !this.#original) return false;
    return JSON.stringify(this.#original) !== JSON.stringify(this.draft);
  }

  private async handleSave() {
    if (!this.draft || !this.systemStore) return;

    if (!this.draft.title.trim()) {
      this.error = "Title is required.";
      return;
    }
    if (!this.draft.root.trim()) {
      this.error = "Root template is required.";
      return;
    }

    this.saving = true;
    this.error = null;

    try {
      await this.systemStore.save(this.draft);

      // Flash "Saved ✓".
      const controls = this.shadowRoot?.querySelector("bees-edit-controls");
      if (controls) (controls as { flashSaved(): void }).flashSaved();

      this.#original = { ...this.draft };
      this.editing = false;
      this.draft = null;
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : "Save failed. Check console.";
      console.error("System config save error:", e);
    } finally {
      this.saving = false;
    }
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
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-system-detail": BeesSystemDetail;
  }
}
