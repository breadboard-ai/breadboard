/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";

@customElement("bb-tooltip")
export class Tooltip extends LitElement {
  @property({ reflect: true })
  accessor visible = false;

  @property()
  accessor message: string | null = null;

  @property()
  set x(x: number) {
    this.#x = x;
    this.style.setProperty("--x", `${x}px`);
  }

  get x() {
    return this.#x;
  }

  @property()
  set y(y: number) {
    this.#y = y;
    this.style.setProperty("--y", `${y}px`);
  }

  get y() {
    return this.#y;
  }

  #x = 100;
  #y = 100;

  static styles = [
    colorsLight,
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: none;
        position: fixed;
        background: var(--n-10);
        color: var(--n-100);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size);
        z-index: 2000;
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        user-select: none;
        animation: none;
        pointer-events: none;
        white-space: nowrap;
      }

      :host([visible="true"]) {
        display: block;
        left: var(--x);
        top: var(--y);
        opacity: 0;
        transform: translateX(-50%) translateY(-100%) translateY(-20px);
        animation: show 0.3s cubic-bezier(0, 0, 0.3, 1) 0.3s forwards;
      }

      @keyframes show {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }
    `,
  ];

  render() {
    if (!this.message) {
      return nothing;
    }

    return html`<div class="sans w-500" aria-live="polite">
      ${this.message}
    </div>`;
  }
}
