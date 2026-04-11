/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * List-of-strings editor rendered as removable chips with an add input.
 *
 * In **view mode**, renders items as read-only chips.
 * In **edit mode**, chips gain a ✕ remove button and an "add" input appears
 * at the end. The add input supports optional autocomplete suggestions.
 *
 * Domain-agnostic — composes via properties and events, no store imports.
 *
 * @fires {CustomEvent<{items: string[]}>} change - When items are added/removed.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export { BeesChipInput };

@customElement("bees-chip-input")
class BeesChipInput extends LitElement {
  /** Current list of string items. */
  @property({ type: Array }) accessor items: string[] = [];

  /** Whether the component is in edit mode. */
  @property({ type: Boolean }) accessor editing = false;

  /** Optional label rendered above the chips. */
  @property() accessor label = "";

  /** CSS class to apply to each chip (for coloring). */
  @property({ attribute: "chip-class" }) accessor chipClass = "";

  /** Autocomplete suggestions (shown in a datalist). */
  @property({ type: Array }) accessor suggestions: string[] = [];

  /** Placeholder text for the add input. */
  @property({ attribute: "add-placeholder" })
  accessor addPlaceholder = "Add…";

  @state() private accessor showSuggestions = false;
  @state() private accessor inputValue = "";

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

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-family: "Google Mono", "Roboto Mono", monospace;
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
      transition: background 0.15s;
    }

    .chip .remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      font-size: 0.6rem;
      line-height: 1;
      color: #64748b;
      cursor: pointer;
      border-radius: 50%;
      transition: color 0.15s, background 0.15s;
    }

    .chip .remove:hover {
      color: #f87171;
      background: #991b1b33;
    }

    .add-input {
      display: inline-flex;
      position: relative;
    }

    .add-input input {
      padding: 3px 8px;
      background: #0f1115;
      border: 1px solid #334155;
      color: #e2e8f0;
      border-radius: 4px;
      font-size: 0.75rem;
      font-family: "Google Mono", "Roboto Mono", monospace;
      width: 120px;
      transition: border-color 0.15s;
    }

    .add-input input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .suggestion-list {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 30;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      margin-top: 2px;
      max-height: 160px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .suggestion-item {
      padding: 6px 10px;
      font-size: 0.75rem;
      font-family: "Google Mono", "Roboto Mono", monospace;
      color: #e2e8f0;
      cursor: pointer;
      transition: background 0.1s;
    }

    .suggestion-item:hover {
      background: #334155;
    }

    .empty-text {
      font-size: 0.75rem;
      color: #475569;
      font-style: italic;
    }
  `;

  render() {
    return html`
      <div class="field">
        ${this.label
          ? html`<span class="label">${this.label}</span>`
          : nothing}
        <div class="chips">
          ${this.items.length === 0 && !this.editing
            ? html`<span class="empty-text">None</span>`
            : this.items.map((item, i) => this.renderChip(item, i))}
          ${this.editing ? this.renderAddInput() : nothing}
        </div>
      </div>
    `;
  }

  private renderChip(item: string, index: number) {
    return html`
      <span class="chip ${this.chipClass}">
        ${item}
        ${this.editing
          ? html`<span
              class="remove"
              @click=${() => this.removeItem(index)}
              title="Remove"
              >✕</span
            >`
          : nothing}
      </span>
    `;
  }

  private renderAddInput() {
    const filtered = this.filteredSuggestions;
    return html`
      <span class="add-input">
        <input
          .value=${this.inputValue}
          placeholder=${this.addPlaceholder}
          @input=${this.handleInput}
          @keydown=${this.handleKeydown}
          @focus=${() => {
            this.showSuggestions = true;
          }}
          @blur=${() => {
            // Delay to allow click on suggestion to fire first.
            setTimeout(() => {
              this.showSuggestions = false;
            }, 150);
          }}
        />
        ${this.showSuggestions && filtered.length > 0
          ? html`
              <div class="suggestion-list">
                ${filtered.map(
                  (s) => html`
                    <div
                      class="suggestion-item"
                      @mousedown=${(e: Event) => {
                        e.preventDefault();
                        this.addItem(s);
                      }}
                    >
                      ${s}
                    </div>
                  `
                )}
              </div>
            `
          : nothing}
      </span>
    `;
  }

  private get filteredSuggestions(): string[] {
    const existing = new Set(this.items);
    const query = this.inputValue.toLowerCase();
    return this.suggestions.filter(
      (s) => !existing.has(s) && s.toLowerCase().includes(query)
    );
  }

  private handleInput(e: InputEvent) {
    this.inputValue = (e.currentTarget as HTMLInputElement).value;
    this.showSuggestions = true;
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = this.inputValue.trim();
      if (val) this.addItem(val);
    }
  }

  private addItem(value: string) {
    if (this.items.includes(value)) return;
    const newItems = [...this.items, value];
    this.inputValue = "";
    this.emitChange(newItems);
  }

  private removeItem(index: number) {
    const newItems = this.items.filter((_, i) => i !== index);
    this.emitChange(newItems);
  }

  private emitChange(items: string[]) {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { items },
        bubbles: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-chip-input": BeesChipInput;
  }
}
