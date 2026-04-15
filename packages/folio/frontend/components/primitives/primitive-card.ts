/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("o-primitive-card")
export class PrimitiveCard extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      background: var(--opal-color-surface-container);
      color: var(--opal-color-on-surface);
      border-radius: var(--opal-radius-pill);
      box-sizing: border-box;
      min-width: 400px;
      padding: var(--opal-grid-6);
      gap: var(--opal-grid-6);
    }
  `;

  #renderHeader() {
    return html`<slot name="header"></slot>`;
  }

  render() {
    return html`
      <header>${this.#renderHeader()}</header>
      <div class="content">
        <slot name="content"></slot>
      </div>
    `;
  }
}
