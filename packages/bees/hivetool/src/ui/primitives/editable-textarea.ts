/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Multi-line editable text area.
 *
 * In **view mode**, renders the value as pre-wrapped text (or a placeholder).
 * In **edit mode**, renders a `<textarea>` that auto-grows with content.
 *
 * Supports a `monospace` flag for markdown/code editing.
 *
 * Domain-agnostic — composes via properties and events, no store imports.
 *
 * @fires {CustomEvent<{value: string}>} change - When the value changes.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export { BeesEditableTextarea };

@customElement("bees-editable-textarea")
class BeesEditableTextarea extends LitElement {
  /** Current text value. */
  @property() accessor value = "";

  /** Whether the field is in edit mode. */
  @property({ type: Boolean }) accessor editing = false;

  /** Use monospace font (for code/markdown). */
  @property({ type: Boolean }) accessor monospace = false;

  /** Placeholder shown when value is empty in view mode. */
  @property() accessor placeholder = "—";

  /** Optional label rendered above the field. */
  @property() accessor label = "";

  /** Minimum height in pixels for the textarea. */
  @property({ type: Number, attribute: "min-height" })
  accessor minHeight = 120;

  static styles = css`
    :host {
      display: block;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .label {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
    }

    .view-value {
      font-size: 0.85rem;
      color: #e2e8f0;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .view-value.empty {
      color: #475569;
      font-style: italic;
    }

    .view-value.mono {
      font-family: "Google Mono", "Roboto Mono", monospace;
      font-size: 0.8rem;
    }

    textarea {
      padding: 10px 12px;
      background: #0f1115;
      border: 1px solid #334155;
      color: #e2e8f0;
      border-radius: 6px;
      font-size: 0.85rem;
      font-family: inherit;
      line-height: 1.5;
      resize: vertical;
      transition: border-color 0.15s;
    }

    textarea:focus {
      outline: none;
      border-color: #3b82f6;
    }

    textarea.mono {
      font-family: "Google Mono", "Roboto Mono", monospace;
      font-size: 0.8rem;
    }
  `;

  render() {
    return html`
      <div class="field">
        ${this.label
          ? html`<span class="label">${this.label}</span>`
          : nothing}
        ${this.editing ? this.renderEdit() : this.renderView()}
      </div>
    `;
  }

  private renderView() {
    const isEmpty = !this.value || this.value.trim() === "";
    return html`
      <div
        class="view-value ${isEmpty ? "empty" : ""} ${this.monospace
          ? "mono"
          : ""}"
      >
        ${isEmpty ? this.placeholder : this.value}
      </div>
    `;
  }

  private renderEdit() {
    return html`
      <textarea
        class="${this.monospace ? "mono" : ""}"
        style="min-height: ${this.minHeight}px"
        .value=${this.value}
        @input=${this.handleInput}
      ></textarea>
    `;
  }

  private handleInput(e: InputEvent) {
    const textarea = e.currentTarget as HTMLTextAreaElement;

    // Auto-grow: reset height then set to scrollHeight.
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, this.minHeight)}px`;

    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: textarea.value },
        bubbles: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-editable-textarea": BeesEditableTextarea;
  }
}
