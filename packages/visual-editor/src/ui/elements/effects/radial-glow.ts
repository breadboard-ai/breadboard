/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";

if ("registerProperty" in CSS) {
  CSS.registerProperty({
    name: "--base-angle",
    syntax: "<angle>",
    inherits: true,
    initialValue: "0deg",
  });

  CSS.registerProperty({
    name: "--mask-angle",
    syntax: "<angle>",
    inherits: true,
    initialValue: "0deg",
  });

  CSS.registerProperty({
    name: "--color-angle",
    syntax: "<angle>",
    inherits: true,
    initialValue: "0deg",
  });

  CSS.registerProperty({
    name: "--opacity-amount",
    syntax: "<number>",
    inherits: true,
    initialValue: "0",
  });
}

@customElement("radial-glow")
export class RadialGlow extends LitElement {
  @property({ type: Number, attribute: "glow-size" })
  accessor glowSize = 32;

  @property({ type: String, attribute: "border-radius" })
  accessor borderRadius: string | null = null;

  @state()
  private accessor resolvedBorderRadius = 24;

  @property({ type: Boolean, attribute: "continuous" })
  accessor continuous = false;

  @state()
  accessor active = false;

  static styles = css`
    :host {
      display: inline-flex;
      will-change: transform;
      pointer-events: none;

      animation:
        mask-spin var(--glow-duration, 3s) cubic-bezier(0.2, 0, 0.5, 1) 1,
        color-spin var(--glow-duration, 3s) cubic-bezier(0.2, 0, 0.5, 1) 1,
        opacity-spin var(--glow-duration, 3s) cubic-bezier(0.2, 0, 0.5, 1) 1;
    }

    :host([continuous]) {
      animation:
        mask-spin var(--glow-duration, 3s) cubic-bezier(0.2, 0, 0.5, 1) infinite,
        color-spin var(--glow-duration, 3s) cubic-bezier(0.2, 0, 0.5, 1)
          infinite,
        base-spin var(--base-spin-duration, 2s) linear infinite;
      --opacity-amount: 1;
    }

    .glow-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      border-radius: var(--border-radius);

      & #content {
        display: inline-flex;
        pointer-events: auto;
      }
    }

    .glow-container::after {
      content: "";
      position: absolute;
      opacity: calc(var(--opacity-amount) * var(--effect-opacity, 1));

      /* The canvas size dictated by the property */
      inset: calc(var(--glow-size) * -1px);

      background: conic-gradient(
        from calc(var(--start-angle, 0deg) + var(--color-angle)),
        var(
          --glow-colors,
          rgba(252, 176, 69, 1) 0%,
          rgba(253, 29, 29, 1) 25%,
          rgba(131, 58, 180, 1) 50%,
          rgba(253, 29, 29, 1) 75%,
          rgba(252, 176, 69, 1) 100%
        )
      );

      mask-image:
        url(#complex-glow-mask),
        conic-gradient(
          from
            calc(
              var(--start-angle, 0deg) + var(--mask-angle) + var(--base-angle)
            ),
          transparent 0deg,
          #000 90deg,
          transparent 270deg
        );

      -webkit-mask-image:
        url(#complex-glow-mask),
        conic-gradient(
          from
            calc(
              var(--start-angle, 0deg) + var(--mask-angle) + var(--base-angle)
            ),
          transparent 0deg,
          #000 90deg,
          transparent 180deg
        );

      mask-composite: intersect;
      -webkit-mask-composite: source-in;
      pointer-events: none;
    }

    @keyframes mask-spin {
      from {
        --mask-angle: 0deg;
      }
      to {
        --mask-angle: var(--mask-sweep, 720deg);
      }
    }

    @keyframes color-spin {
      from {
        --color-angle: 0deg;
      }
      to {
        --color-angle: var(--color-sweep, 720deg);
      }
    }

    @keyframes opacity-spin {
      0% {
        --opacity-amount: 0;
      }
      20% {
        --opacity-amount: 1;
      }
      55% {
        --opacity-amount: 1;
      }
      90% {
        --opacity-amount: 0;
      }
    }

    @keyframes base-spin {
      0% {
        --base-angle: 0deg;
      }
      100% {
        --base-angle: 360deg;
      }
    }
  `;

  private resizeObserver: ResizeObserver | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => {
      this.updateBorderRadius();
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  private handleSlotChange(e: Event) {
    const slot = e.target as HTMLSlotElement;
    const elements = slot.assignedElements({ flatten: true });

    this.active = elements.length !== 0;
    this.resizeObserver?.disconnect();

    if (!this.active) return;

    const firstElement = elements.at(0)!;
    this.resizeObserver?.observe(firstElement);
    this.updateBorderRadius();
  }

  private updateBorderRadius() {
    const slot = this.renderRoot.querySelector("slot");
    if (!slot) return;
    const elements = slot.assignedElements({ flatten: true });
    if (elements.length === 0) return;

    const firstElement = elements.at(0)!;

    let radiusStr = this.borderRadius;
    if (!radiusStr) {
      const style = window.getComputedStyle(firstElement);
      radiusStr = style.borderTopLeftRadius;
    }

    const match = radiusStr.match(/(\d+(?:\.\d+)?)%/);
    if (match) {
      const pct = Number.parseFloat(match[1]) / 100;
      if (Number.isNaN(pct)) {
        this.resolvedBorderRadius = 0;
      } else {
        const rect = firstElement.getBoundingClientRect();
        this.resolvedBorderRadius = rect.width * pct;
      }
    } else {
      const val = Number.parseFloat(radiusStr);
      this.resolvedBorderRadius = Number.isNaN(val) ? 0 : val;
    }
  }

  render() {
    const slot = html`<slot
      @slotchange=${(e: Event) => this.handleSlotChange(e)}
    ></slot>`;
    if (!this.active) return slot;

    const S = this.glowSize;
    const R = this.resolvedBorderRadius;

    // Mathematical parameters for the SVG
    const blurStdDev = S / 2.5;
    const baseX = S;
    const baseR = R;
    const holeX = S;
    const holeW = S * 2;

    return html`
      <div
        class="glow-container"
        style=${styleMap({ "--glow-size": S, "--border-radius": `${R}px` })}
      >
        <div id="content">${slot}</div>
        ${svg`<svg width="calc(100% + ${S} * 2px)" height="calc(100% + ${S} * 2px)" style=${styleMap({ position: "absolute", top: `-${S}px`, left: `-${S}px` })}>
            <defs>
              <filter id="glow-blur" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
                <feGaussianBlur stdDeviation="${blurStdDev}" />
              </filter>

              <mask id="complex-glow-mask">
                <rect
                  x="${baseX - 2}" y="${baseX - 2}"
                  width="calc(100% - ${holeW - 4}px)" height="calc(100% - ${holeW - 4}px)"
                  rx="${baseR + 2}"
                  fill="white"
                  filter="url(#glow-blur)"
                />
                <rect
                  x="${holeX}" y="${holeX}"
                  width="calc(100% - ${holeW}px)" height="calc(100% - ${holeW}px)"
                  rx="${R}"
                  fill="black"
                />
              </mask>
            </defs>
          </svg>
        `}
      </div>
    `;
  }
}
