/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("folio-input")
export class FolioInput extends LitElement {
  @property({ type: String })
  accessor value = "";

  @property({ type: String })
  accessor placeholder = "Type a message or command...";

  static styles = css`
    :host {
      display: block;
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      font-family: "Inter", sans-serif;
    }

    .wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .container {
      display: flex;
      align-items: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      padding: 6px 12px;
      width: 100%;
      box-shadow:
        0 4px 6px -1px rgba(0, 0, 0, 0.05),
        0 2px 4px -1px rgba(0, 0, 0, 0.03);
      transition: all 0.2s ease;
    }

    .container:focus-within {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .add-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      border: none;
      border-radius: 16px;
      padding: 6px 12px;
      font-size: 0.85rem;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      transition: background 0.2s ease;
      white-space: nowrap;
    }

    .add-btn:hover {
      background: #e2e8f0;
    }

    .plus-icon {
      font-size: 1rem;
      font-weight: bold;
    }

    input {
      flex: 1;
      border: none;
      outline: none;
      padding: 8px 12px;
      font-size: 0.95rem;
      color: #1e293b;
      background: transparent;
    }

    input::placeholder {
      color: #94a3b8;
    }

    .shortcut {
      font-size: 0.75rem;
      color: #94a3b8;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 2px 6px;
      font-family: monospace;
      margin-left: 8px;
      white-space: nowrap;
    }

    .status-text {
      font-size: 0.65rem;
      color: #94a3b8;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
  `;

  render() {
    return html`
      <div class="wrapper">
        <div class="container">
          <button class="add-btn">
            <span class="plus-icon">+</span>
            Add Block
          </button>
          <input
            type="text"
            .value=${this.value}
            placeholder=${this.placeholder}
            @input=${this.#onInput}
            @keydown=${this.#onKeyDown}
          />
          <span class="shortcut">⌘+B</span>
        </div>
        <div class="status-text">Opie is ready for next input</div>
      </div>
    `;
  }

  #onInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.value = input.value;
  }

  #onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      this.dispatchEvent(
        new CustomEvent("submit", {
          detail: { value: this.value },
          bubbles: true,
          composed: true,
        })
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "folio-input": FolioInput;
  }
}
