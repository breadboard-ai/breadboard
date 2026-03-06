/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

export { ArkPrompt };

/**
 * Prompt input bar — text input + Generate button.
 *
 * Dispatches a `start-run` CustomEvent with the objective string when
 * the user clicks Generate or presses Enter.
 */
@customElement("ark-prompt")
class ArkPrompt extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      gap: 8px;
      padding: 16px 24px;
      background: var(--ark-surface, #f5f5f5);
    }

    input {
      flex: 1;
      padding: 12px 16px;
      border: 1px solid #ddd;
      border-radius: 10px;
      font-size: 15px;
      font-family: inherit;
      background: #fff;
      outline: none;
      transition: border-color 0.15s;
    }

    input:focus {
      border-color: var(--ark-accent, #4f46e5);
    }

    input::placeholder {
      color: #aaa;
    }

    button {
      padding: 12px 24px;
      border: none;
      border-radius: 10px;
      background: var(--ark-accent, #4f46e5);
      color: white;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
    }

    button:hover {
      background: #4338ca;
    }

    button:active {
      background: #3730a3;
    }
  `;

  override render() {
    return html`
      <input
        type="text"
        placeholder="What should the UI do?"
        @keydown=${this.#onKeydown}
      />
      <button @click=${this.#onGenerate}>Generate</button>
    `;
  }

  #onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") this.#onGenerate();
  }

  #onGenerate() {
    const input = this.shadowRoot!.querySelector("input")!;
    const objective = input.value.trim();
    if (!objective) return;
    input.value = "";

    this.dispatchEvent(
      new CustomEvent("start-run", {
        detail: { objective },
        bubbles: true,
        composed: true,
      })
    );
  }
}
