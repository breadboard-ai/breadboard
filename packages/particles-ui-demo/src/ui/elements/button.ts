/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styles } from "../styles/index";

@customElement("ui-button")
export class UIButton extends SignalWatcher(LitElement) {
  static styles = [
    styles,
    css`
      :host {
        display: block;
        position: relative;
      }

      div {
        display: flex;
        align-items: center;
        width: min-content;
        pointer-events: none;
        white-space: nowrap;
        background: inherit;
        color: inherit;
        font: inherit;
        border: none;
        outline: none;
      }
    `,
  ];

  @property({ attribute: true })
  accessor role: string | null = "button";

  @property()
  accessor icon: string | null = null;

  render() {
    return html`<div
      tabindex="0"
      @keydown=${(evt: KeyboardEvent) => {
        if (evt.key === "Enter" || evt.key === " ") {
          this.click();
        }
      }}
    >
      ${this.icon
        ? html`<span class="g-icon layout-mr-2">${this.icon}</span>`
        : nothing}
      <slot></slot>
    </div>`;
  }
}
