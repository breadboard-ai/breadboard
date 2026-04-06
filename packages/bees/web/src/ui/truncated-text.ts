/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A text container that truncates long content with a fade-out gradient
 * and an expand/collapse toggle button.
 *
 * Uses the same visual pattern as log-detail's `.part-text.long`:
 * max-height clamp, `::after` fade gradient, and a `»` toggle.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export { BeesTruncatedText };

@customElement("bees-truncated-text")
class BeesTruncatedText extends LitElement {
  /** Character threshold above which content is truncated. */
  @property({ type: Number }) accessor threshold = 300;

  /** Max height in pixels when collapsed. */
  @property({ type: Number, attribute: "max-height" })
  accessor maxHeight = 150;

  /** Background color for the fade gradient (must match parent). */
  @property() accessor fadeBg = "#0f1115";

  static styles = css`
    :host {
      display: block;
    }

    .body {
      position: relative;
      word-break: break-word;
      font-size: 0.8rem;
      line-height: 1.5;
      color: #e2e8f0;
      overflow: hidden;
    }

    .body.clamped::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 36px;
      pointer-events: none;
    }

    .toggle {
      position: absolute;
      bottom: 4px;
      right: 4px;
      z-index: 2;
      padding: 2px 6px;
      border: none;
      border-radius: 4px;
      background: #1e293b;
      color: #94a3b8;
      cursor: pointer;
      font-size: 0.8rem;
      font-family: inherit;
      line-height: 1;
      transform: rotate(90deg);
      opacity: 0.85;
      transition:
        opacity 0.15s,
        color 0.15s;
    }

    .toggle:hover {
      opacity: 1;
      color: #e2e8f0;
    }
  `;

  @state() private accessor expanded = false;

  render() {
    const text = (this.textContent ?? "").trim();
    const isLong = text.length > this.threshold;

    const bodyStyle =
      isLong && !this.expanded ? `max-height: ${this.maxHeight}px` : "";

    const fadeStyle =
      isLong && !this.expanded
        ? `background: linear-gradient(transparent, ${this.fadeBg})`
        : "";

    return html`
      <div
        class="body ${isLong && !this.expanded ? "clamped" : ""}"
        style="${bodyStyle}"
      >
        <slot></slot>
        ${isLong && !this.expanded
          ? html`<button class="toggle" @click=${this.handleExpand}>»</button>`
          : nothing}
        ${isLong && this.expanded
          ? html`<button class="toggle" @click=${this.handleCollapse}>
              «
            </button>`
          : nothing}
      </div>
      <style>
        .body.clamped::after { ${fadeStyle ? fadeStyle : ""} }
      </style>
    `;
  }

  private handleExpand() {
    this.expanded = true;
  }

  private handleCollapse() {
    this.expanded = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-truncated-text": BeesTruncatedText;
  }
}
