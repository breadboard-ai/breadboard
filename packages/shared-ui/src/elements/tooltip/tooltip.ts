/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";

const PADDING = 20;

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

  @property()
  set x(x: number) {
    const bounds = this.#boundingClientRect;
    const root = this.#rootBounds;

    if (bounds && root) {
      if (bounds.left < 0) {
        x = bounds.width * 0.5 + PADDING;
      } else if (bounds.right > root.width) {
        x = root.width - bounds.width * 0.5 - PADDING;
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
    const bounds = this.#boundingClientRect;
    const root = this.#rootBounds;

    if (bounds && root) {
      if (bounds.top < 0) {
        y = bounds.height * 0.5 + PADDING;
      } else if (bounds.bottom > root.height) {
        y = root.height - bounds.height * 0.5 - PADDING;
      }
    }

    this.#y = y;
    this.style.setProperty("--y", `${this.y}px`);
  }
  get y() {
    return this.#y;
  }

  #visible = false;
  #x = 100;
  #y = 100;
  #boundingClientRect: DOMRectReadOnly | null = null;
  #rootBounds: DOMRectReadOnly | null = null;
  #intersectionObserver = new IntersectionObserver((entries) => {
    const [intersection] = entries;

    this.#boundingClientRect = intersection.boundingClientRect;
    this.#rootBounds = intersection.rootBounds;
  });

  #animationStartBound = this.#animationStart.bind(this);
  #animationStart() {
    // Force an update on the position now we know the precise sizing of the
    // tooltip.
    this.x = this.x + 0;
    this.y = this.y + 0;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("animationstart", this.#animationStartBound);

    this.#intersectionObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("animationstart", this.#animationStartBound);

    this.#intersectionObserver.disconnect();
  }

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
        padding: var(--bb-grid-size) var(--bb-grid-size-2);
        border-radius: var(--bb-grid-size);
        z-index: 2000;
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

    return html`<div class="sans w-400 md-body-small" aria-live="polite">
      ${this.message}
    </div>`;
  }
}
