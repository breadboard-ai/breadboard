/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-switcher")
export class Switcher extends LitElement {
  @property({
    hasChanged(value: unknown) {
      return typeof value === "number";
    },
  })
  accessor selected = 0;

  @property({ reflect: true, attribute: true })
  accessor disabled = false;

  @property({ reflect: true, type: Number })
  accessor slots = 2;

  static styles = css`
    :host {
      display: grid;
      grid-template-rows: calc(var(--bb-grid-size) * 10) auto;
      overflow: auto;
      position: relative;
    }

    #buttons {
      background: #f8fafd;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      border-bottom: 1px solid #d9d9d9;
    }

    #buttons button {
      margin: 0 calc(var(--bb-grid-size) * 2);
      background: none;
      border: none;
      position: relative;
      height: calc(var(--bb-grid-size) * 8);
      font-size: var(--bb-font-medium);
      opacity: 0.4;
      white-space: nowrap;
    }

    #buttons button:not([disabled]):hover,
    #buttons button:not([disabled])[active] {
      opacity: 1;
    }

    #buttons button[active]::after {
      content: "";
      border-radius: 10px 10px 0 0;
      background: var(--bb-selected-color);
      position: absolute;
      left: 0;
      height: 3px;
      bottom: 0;
      width: 100%;
    }

    slot {
      display: none;
    }

    slot[active] {
      display: block;
      width: 100%;
      height: 100%;
      overflow: auto;
    }
  `;

  render() {
    const renderableChildren = new Array(this.slots).fill(null);
    return html` <div id="buttons">
      ${renderableChildren.map((_, idx) => {
        if (!this.children[idx]) {
          console.warn(`No child found in index ${idx}`);
          return nothing;
        }

        return html`<button
          ?disabled=${this.disabled}
          ?active=${this.selected === idx}
          @click=${() => (this.selected = idx)}
        >
          ${this.children[idx].getAttribute("name") || "Unnamed tab"}
        </button>`;
      })}
      </div>
      ${renderableChildren.map((_, idx) => {
        return html`<slot
          ?active=${this.selected === idx}
          name="slot-${idx}"
        ></slot>`;
      })}
    </div>`;
  }
}
