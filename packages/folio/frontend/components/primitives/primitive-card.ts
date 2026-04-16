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
      background: var(
        --o-primitive-card-bg,
        var(--opal-color-surface-container)
      );
      color: var(--opal-color-on-surface);
      border-radius: var(--opal-radius-pill);
      gap: var(--opal-grid-3);
      overflow: hidden;
    }

    section {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: var(--opal-grid-8) var(--opal-grid-6);
      mask: linear-gradient(
        to bottom,
        #ff00ff,
        #ff00ff calc(100% - var(--opal-grid-12)),
        #ff00ff00 100%
      );
    }

    .content {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      opacity: var(--o-primitive-card-content-opacity, 1);
      transition: opacity 0.3s ease;
      scrollbar-width: none;
      padding-bottom: var(--opal-grid-6);
      margin-top: var(--opal-grid-3);
      mask: linear-gradient(
        to bottom,
        #ff00ff,
        #ff00ff calc(100% - var(--opal-grid-6)),
        #ff00ff00 100%
      );
    }

    ::slotted([slot="header"]) {
      font-family: var(--opal-font-display);
      font-size: var(--opal-headline-large-size);
      font-weight: var(--opal-headline-large-weight);
      line-height: var(--opal-headline-large-line-height);
      font-feature-settings: var(--opal-headline-large-font-feature);
      color: var(--opal-color-on-surface);
      display: block;
    }

    ::slotted([slot="content"]) {
      font-family: var(--opal-font-display);
      font-size: var(--opal-body-large-size);
      font-weight: var(--opal-body-large-weight);
      line-height: var(--opal-body-large-line-height);
      font-feature-settings: var(--opal-body-large-font-feature);
      color: var(--opal-color-on-surface-variant);
    }

    ::slotted([slot="actions"]) {
      display: flex;
      justify-content: space-between;
      margin-top: auto;
    }
  `;

  #renderHeader() {
    return html`<slot name="header"></slot>`;
  }

  render() {
    return html`
      <section>
        <header>${this.#renderHeader()}</header>
        <div class="content">
          <slot name="content"></slot>
        </div>
        <slot name="actions"></slot>
      </section>
    `;
  }
}
