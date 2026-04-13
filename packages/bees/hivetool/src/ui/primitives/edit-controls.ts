/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Save / Cancel / Delete button bar for edit mode.
 *
 * Shows contextual controls depending on state:
 * - **Editing + dirty**: Save (primary) + Cancel buttons.
 * - **Editing + clean**: Cancel button only.
 * - **Saving**: Spinner on the Save button.
 * - **Just saved**: Brief "Saved ✓" flash.
 * - **Delete**: Optional destructive action with confirmation.
 *
 * Domain-agnostic — composes via properties and events, no store imports.
 *
 * @fires save - When the Save button is clicked.
 * @fires cancel - When the Cancel button is clicked.
 * @fires delete - When deletion is confirmed.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export { BeesEditControls };

@customElement("bees-edit-controls")
class BeesEditControls extends LitElement {
  /** Whether unsaved changes exist. */
  @property({ type: Boolean }) accessor dirty = false;

  /** Whether a save operation is in progress. */
  @property({ type: Boolean }) accessor saving = false;

  /** Whether to show the delete button. */
  @property({ type: Boolean, attribute: "show-delete" })
  accessor showDelete = false;

  /** Custom label for the delete action. */
  @property({ attribute: "delete-label" })
  accessor deleteLabel = "Delete";

  @state() private accessor confirming = false;
  @state() private accessor savedFlash = false;

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn {
      padding: 5px 14px;
      border: none;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.15s, background 0.15s;
      white-space: nowrap;
    }

    .btn:hover {
      opacity: 0.9;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-save {
      background: #3b82f6;
      color: #fff;
    }

    .btn-save.saved {
      background: #059669;
    }

    .btn-cancel {
      background: transparent;
      color: #94a3b8;
      border: 1px solid #334155;
    }

    .btn-cancel:hover {
      color: #e2e8f0;
      border-color: #475569;
    }

    .btn-delete {
      background: transparent;
      color: #f87171;
      border: 1px solid #991b1b;
    }

    .btn-delete:hover {
      background: #991b1b33;
    }

    .btn-confirm-delete {
      background: #dc2626;
      color: #fff;
    }

    .spacer {
      flex: 1;
    }

    .dirty-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #f59e0b;
      flex-shrink: 0;
      title: "Unsaved changes";
    }

    .spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      margin-right: 4px;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  render() {
    return html`
      ${this.dirty ? html`<span class="dirty-dot"></span>` : nothing}
      ${this.renderSaveButton()}
      <button class="btn btn-cancel" @click=${this.handleCancel}>
        Cancel
      </button>
      ${this.showDelete
        ? html`
            <span class="spacer"></span>
            ${this.renderDeleteButton()}
          `
        : nothing}
    `;
  }

  private renderSaveButton() {
    if (this.savedFlash) {
      return html`<button class="btn btn-save saved" disabled>
        Saved ✓
      </button>`;
    }

    return html`
      <button
        class="btn btn-save"
        ?disabled=${!this.dirty || this.saving}
        @click=${this.handleSave}
      >
        ${this.saving
          ? html`<span class="spinner"></span>Saving…`
          : "Save"}
      </button>
    `;
  }

  private renderDeleteButton() {
    if (this.confirming) {
      return html`
        <button class="btn btn-confirm-delete" @click=${this.handleDelete}>
          Confirm ${this.deleteLabel}
        </button>
        <button
          class="btn btn-cancel"
          @click=${() => {
            this.confirming = false;
          }}
        >
          No
        </button>
      `;
    }

    return html`
      <button
        class="btn btn-delete"
        @click=${() => {
          this.confirming = true;
        }}
      >
        ${this.deleteLabel}
      </button>
    `;
  }

  private handleSave() {
    this.dispatchEvent(new Event("save", { bubbles: true }));
  }

  private handleCancel() {
    this.confirming = false;
    this.dispatchEvent(new Event("cancel", { bubbles: true }));
  }

  private handleDelete() {
    this.confirming = false;
    this.dispatchEvent(new Event("delete", { bubbles: true }));
  }

  /** Trigger the "Saved ✓" flash. Call after a successful save. */
  flashSaved() {
    this.savedFlash = true;
    setTimeout(() => {
      this.savedFlash = false;
    }, 1500);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-edit-controls": BeesEditControls;
  }
}
