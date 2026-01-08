/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, nothing, svg } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import * as Styles from "../../styles/styles";
import { Root } from "../root";

@customElement("drawable-canvas")
export class DrawableCanvas extends Root {
  static styles = [
    Styles.Theme.colorScheme,
    Styles.Icons.icons,
    css`
      :host {
        display: grid;
        grid-template-rows: 1fr 36px;
        gap: var(--bb-grid-size-2);
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        touch-action: none;
        overflow: auto;
      }

      svg {
        display: block;
        width: 100%;
        height: 100%;
        background-color: light-dark(#f2f2f2, #111);
      }

      path {
        fill: none;
        stroke: light-dark(black, white);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      #controls {
        display: flex;
        justify-content: space-between;

        & button {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--bb-grid-size-2);
          color: var(--primary);
          background: oklch(from var(--primary) l c h / calc(alpha * 0.2));
          opacity: 0.4;
          border: none;
          transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
          padding: 0 var(--bb-grid-size-5) 0 var(--bb-grid-size-2);
          pointer-events: auto;

          & .g-icon {
            margin-right: var(--bb-grid-size-2);
          }

          &:not([disabled]) {
            opacity: 1;
            cursor: pointer;
          }
        }
      }
    `,
  ];

  @state()
  accessor #currentShape: string | null = null;

  @query("svg")
  accessor #svg: SVGElement | null = null;

  #bounds: DOMRect = new DOMRect();
  #adjustment = new DOMPoint();

  #isDrawing = false;
  #resizeObserver = new ResizeObserver(() => {
    if (!this.#svg) {
      return;
    }

    const svgBounds = this.#svg.getBoundingClientRect();
    const oldWidth = this.#bounds.width;
    const oldHeight = this.#bounds.height;

    this.#bounds.width = svgBounds.width;
    this.#bounds.height = svgBounds.height;

    if (oldHeight !== 0 && oldWidth !== 0) {
      const deltaX = (oldWidth - this.#bounds.width) * 0.5;
      const deltaY = (oldHeight - this.#bounds.height) * 0.5;

      this.#adjustment.x += deltaX;
      this.#adjustment.y += deltaY;
    }

    this.requestUpdate();
  });

  connectedCallback(): void {
    super.connectedCallback();
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
  }

  #startDrawing(e: PointerEvent) {
    this.#isDrawing = true;
    if (e.target instanceof SVGElement) {
      e.target.setPointerCapture(e.pointerId);
    }

    const x = e.offsetX + this.#adjustment.x;
    const y = e.offsetY + this.#adjustment.y;

    this.#currentShape = `M ${x} ${y}`;
  }

  #draw(e: PointerEvent) {
    const x = e.offsetX + this.#adjustment.x;
    const y = e.offsetY + this.#adjustment.y;

    if (!this.#isDrawing) return;

    this.#currentShape += ` L ${x} ${y}`;
    this.requestUpdate();
  }

  #stopDrawing(e: PointerEvent) {
    if (!this.#isDrawing) return;
    if (!this.#currentShape) return;

    if (!this.#currentShape.includes("L")) {
      const x = e.offsetX + this.#adjustment.x;
      const y = e.offsetY + this.#adjustment.y;

      this.#currentShape += `L ${x + 1} ${y}`;
    }

    this.controller.drawing.addShape(this.#currentShape);

    this.#currentShape = null;
    this.#isDrawing = false;
  }

  #renderCurrentPath() {
    if (!this.#currentShape) return nothing;
    return this.#renderShape(this.#currentShape);
  }

  #renderShape(shape: string) {
    return svg`<path stroke="#000" fill="none" d=${shape} />`;
  }

  render() {
    if (!this.controller.drawing.shapes) return nothing;

    const shapes = this.controller.drawing.shapes;

    return html`${svg`
      <svg
        viewBox="${this.#adjustment.x} ${this.#adjustment.y} ${
        this.#bounds.width
      } ${this.#bounds.height}"
        @pointerdown=${this.#startDrawing}
        @pointermove=${this.#draw}
        @pointerup=${this.#stopDrawing}
        @pointerleave=${this.#stopDrawing}
      >
        ${shapes.map((shape) => this.#renderShape(shape))}
        ${this.#renderCurrentPath()}
      </svg>
    `}
      <div id="controls">
        <button
          @click=${() => {
            this.clear();
          }}
        >
          <span class="g-icon filled round">delete</span> Clear
        </button>
      </div> `;
  }

  public clear() {
    if (!this.controller.drawing.shapes) return;
    this.controller.drawing.setShapes([]);
    this.#currentShape = null;
  }
}
