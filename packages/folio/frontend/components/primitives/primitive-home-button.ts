/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { icons } from "../../ui/icons.js";

@customElement("o-primitive-home-button")
export class PrimitiveHomeButton extends SignalWatcher(LitElement) {
  @property({ type: Boolean, reflect: true })
  accessor selected = false;

  static styles = [
    icons,
    css`
      :host {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        width: var(--opal-grid-10);
        height: var(--opal-grid-10);
        box-sizing: border-box;
        position: relative;
        cursor: pointer;
        background: var(--opal-color-home-button-background);
        border-radius: 50%;
      }

      :host([selected]) {
        cursor: auto;
      }

      :host::after {
        content: "";
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        border: 2px solid var(--opal-color-avatar-hover-ring);
        border-radius: 50%;
        pointer-events: none;
        opacity: 0;
        transition:
          opacity 0.2s ease,
          border-color 0.2s ease;
      }

      :host(:hover)::after {
        opacity: 1;
        border-color: var(--opal-color-avatar-hover-ring);
      }

      :host([selected])::after {
        opacity: 1;
        border-color: var(--opal-color-avatar-selected-ring);
      }

      .g-icon {
        font-size: var(--opal-radius-pill);
        color: var(--opal-color-home-icon);
      }
    `,
  ];

  render() {
    return html`<span class="g-icon filled heavy round">home</span>`;
  }
}
