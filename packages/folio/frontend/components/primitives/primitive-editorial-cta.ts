/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

/**
 * A specialized CTA box for editorial cards.
 */
@customElement("o-primitive-editorial-cta")
export class PrimitiveEditorialCta extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      background: var(--opal-color-surface-tinted);
      border-radius: var(--opal-radius-20);
      padding: var(--opal-grid-4);
      gap: var(--opal-grid-6);
      margin-top: var(--opal-grid-5);
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: var(--opal-grid-2);
    }

    ::slotted([slot="icon"]) {
      --g-icon-font-size: 18px;
      --g-icon-width: 24px;
      --g-icon-height: 24px;
      --g-icon-display: flex;
      color: var(--opal-color-primary);
      align-items: center;
      justify-content: center;
      background: var(--opal-color-surface);
      border-radius: var(--opal-radius-4);
    }

    ::slotted(img[slot="icon"]) {
      width: 24px;
      height: 24px;
      border-radius: var(--opal-radius-4);
      object-fit: cover;
      background: none;
    }

    ::slotted([slot="title"]) {
      margin: 0;
      font-family: var(--opal-font-display);
      font-size: var(--opal-title-medium-size);
      font-weight: var(--opal-title-medium-weight);
      line-height: var(--opal-title-medium-line-height);
      font-feature-settings: var(--opal-title-medium-font-feature);
      color: var(--opal-color-on-surface);
      text-align: center;
    }

    ::slotted([slot="price"]) {
      color: var(--opal-color-on-surface-variant);
      font-family: var(--opal-font-display);
      font-size: var(--opal-body-large-size);
      font-weight: var(--opal-body-large-weight);
      line-height: var(--opal-body-large-line-height);
      font-feature-settings: var(--opal-body-large-font-feature);
    }

    .controls {
      display: flex;
      gap: var(--opal-grid-3);
    }

    ::slotted(button) {
      border-radius: var(--opal-radius-pill);
      padding: var(--opal-grid-3) var(--opal-grid-5);
      border: none;
      cursor: pointer;
      font-weight: 500;
      font-family: var(--opal-font-display);
      background: var(--opal-color-interactive-surface);
      color: var(--opal-color-on-surface);
    }

    ::slotted(button.agent) {
      background: var(--agent-color, var(--opal-color-interactive-surface));
      color: var(--agent-text-color, var(--opal-color-on-surface));
    }

    ::slotted(button.secondary) {
      background: var(--opal-color-surface);
      border: 1px solid transparent;
    }
  `;

  render() {
    return html`
      <header>
        <div class="header-left">
          <slot name="icon"></slot>
          <slot name="title"></slot>
        </div>
        <slot name="price"></slot>
      </header>
      <div class="controls">
        <slot></slot>
      </div>
    `;
  }
}
