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
        display: flex;
        align-items: center;
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

      :host([disabled][showspinnerwhendisabled]) .g-icon {
        animation: rotate 1s linear infinite;
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  @property({ attribute: true })
  accessor role: string | null = "button";

  @property()
  accessor icon: string | null = null;

  @property({ attribute: true, reflect: true, type: Boolean })
  accessor disabled = false;

  @property({ reflect: true, type: Boolean })
  accessor showSpinnerWhenDisabled = false;

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
        ? html`<span class="g-icon filled round layout-mr-2"
            >${this.disabled && this.showSpinnerWhenDisabled
              ? "progress_activity"
              : this.icon}</span
          >`
        : nothing}
      <slot></slot>
    </div>`;
  }
}
