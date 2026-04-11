/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Single-line editable text field.
 *
 * In **view mode**, renders the value as plain text (or a placeholder if
 * empty). In **edit mode**, renders an `<input>` bound to the value.
 *
 * Domain-agnostic — composes via properties and events, no store imports.
 *
 * @fires {CustomEvent<{value: string}>} change - When the value changes.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export { BeesEditableField };

@customElement("bees-editable-field")
class BeesEditableField extends LitElement {
  /** Current text value. */
  @property() accessor value = "";

  /** Whether the field is in edit mode. */
  @property({ type: Boolean }) accessor editing = false;

  /** Placeholder shown when value is empty in view mode. */
  @property() accessor placeholder = "—";

  /** Optional label rendered above the field. */
  @property() accessor label = "";

  /** Input type (text, url, etc). */
  @property() accessor type = "text";

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
    }

    .view-value.empty {
      color: #475569;
      font-style: italic;
    }

    input {
      padding: 6px 10px;
      background: #0f1115;
      border: 1px solid #334155;
      color: #e2e8f0;
      border-radius: 6px;
      font-size: 0.85rem;
      font-family: inherit;
      transition: border-color 0.15s;
    }

    input:focus {
      outline: none;
      border-color: #3b82f6;
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
      <span class="view-value ${isEmpty ? "empty" : ""}">
        ${isEmpty ? this.placeholder : this.value}
      </span>
    `;
  }

  private renderEdit() {
    return html`
      <input
        .type=${this.type}
        .value=${this.value}
        @input=${this.handleInput}
      />
    `;
  }

  private handleInput(e: InputEvent) {
    const input = e.currentTarget as HTMLInputElement;
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: input.value },
        bubbles: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-editable-field": BeesEditableField;
  }
}
