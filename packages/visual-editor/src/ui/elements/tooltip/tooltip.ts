/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseColors } from "../../styles/host/base-colors";
import { type } from "../../styles/host/type";
import { classMap } from "lit/directives/class-map.js";

const PADDING = 26;

@customElement("bb-tooltip")
export class Tooltip extends LitElement {
  @property({ reflect: true })
  set visible(visible: boolean) {
    this.#visible = visible;
  }
  get visible() {
    return this.#visible;
  }

  @property()
  accessor message: string | null = null;

  #x = 100;
  #y = 100;
  #visible = false;

  get #viewportBounds(): { width: number; height: number } {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  get #currentBounds(): DOMRect {
    return this.getBoundingClientRect();
  }

  @property()
  set x(x: number) {
    const bounds = this.#currentBounds;
    const root = this.#viewportBounds;

    // Only adjust if we have a real width.
    if (bounds.width > 0) {
      const tooltipHalfWidth = bounds.width * 0.5;
      // Check boundaries.
      if (x - tooltipHalfWidth < PADDING) {
        x = tooltipHalfWidth + PADDING * 0.5;
      } else if (x + tooltipHalfWidth > root.width - PADDING) {
        x = root.width - tooltipHalfWidth - PADDING * 0.5;
      }
    }

    this.#x = x;
    this.style.setProperty("--x", `${x}px`);
  }
  get x() {
    return this.#x;
  }

  @property()
  set y(y: number) {
    const bounds = this.#currentBounds;
    const root = this.#viewportBounds;

    // Only adjust if we have a real height.
    if (bounds.height > 0) {
      const tooltipHeight = bounds.height;

      // Check boundaries (accounting for the CSS translateY(-100%) shift).
      if (y - tooltipHeight - PADDING < PADDING) {
        y = tooltipHeight + PADDING;
      } else if (y > root.height - PADDING) {
        y = root.height - PADDING;
      }
    }

    this.#y = y;
    this.style.setProperty("--y", `${this.y}px`);
  }
  get y() {
    return this.#y;
  }

  @property({ reflect: true })
  accessor status: { title: string } | false = false;

  #animationStartBound = this.#animationStart.bind(this);
  #animationStart() {
    // Force the setters to run *now* that the element has a non-zero size
    // (due to display: block being applied).
    this.x = this.x + 0;
    this.y = this.y + 0;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("animationstart", this.#animationStartBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("animationstart", this.#animationStartBound);
  }

  static styles = [
    baseColors,
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: none;
        position: fixed;
        background: var(--light-dark-n-10);
        color: var(--light-dark-n-100);
        padding: var(--bb-grid-size) var(--bb-grid-size-2);
        border-radius: var(--bb-grid-size);
        z-index: 2000;
        user-select: none;
        animation: none;
        pointer-events: none;
        white-space: nowrap;
      }

      :host(:not([status="false"])) {
        padding: var(--bb-grid-size-6);
        border-radius: var(--bb-grid-size-6);
        max-width: 360px;
        white-space: wrap;
      }

      :host([visible="true"]) {
        display: block;
        left: var(--x);
        top: var(--y);
        opacity: 0;
        transform: translateX(-50%) translateY(-100%) translateY(-20px);
        animation: show 0.3s cubic-bezier(0, 0, 0.3, 1) 0.3s forwards;
      }

      h1,
      p {
        margin: 0;
      }

      h1 {
        margin-bottom: var(--bb-grid-size-3);
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

    const classes: Record<string, boolean> = {
      sans: true,
      "w-400": true,
    };

    if (this.status !== false) {
      classes["md-body-medium"] = true;
    } else {
      classes["md-body-small"] = true;
    }

    return html`<div class=${classMap(classes)} aria-live="polite">
      ${this.status !== false
        ? html`<h1 class="w-500 sans md-body-medium">${this.status.title}</h1>`
        : nothing}
      <p>${this.message}</p>
    </div>`;
  }
}
