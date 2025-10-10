/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html, nothing, svg } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { EnumValue } from "../types/types";
import * as Styles from "../../0.8/ui/styles/index";
import { ItemSelect } from "./item-select";

type RenderMode = "free" | "line" | "rect";
interface Path {
  type: "free";
  value: string;
}
interface Line {
  type: "line";
  value: { sx: number; sy: number; dx: number; dy: number };
}
interface Rect {
  type: "rect";
  value: {
    bx: number;
    by: number;
    sx: number;
    sy: number;
    dx: number;
    dy: number;
  };
}
type Shape = Path | Line | Rect;

function isPath(shape: Shape | null): shape is Path {
  return shape !== null && shape.type === "free";
}

function isLine(shape: Shape | null): shape is Line {
  return shape !== null && shape.type === "line";
}

function isRect(shape: Shape | null): shape is Rect {
  return shape !== null && shape.type === "rect";
}

const values: EnumValue[] = [
  {
    id: "free",
    title: "Freehand",
    icon: "draw",
  },
  {
    id: "line",
    title: "Line",
    icon: "pen_size_1",
  },
  {
    id: "rect",
    title: "Rectangle",
    icon: "rectangle",
  },
];

@customElement("drawable-canvas")
export class DrawableCanvas extends LitElement {
  static styles = [
    Styles.all,
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
        background-color: #f2f2f2;
      }

      path {
        fill: none;
        stroke: black;
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

      item-select {
        --menu-width: 160px;
        --selected-item-select-height: var(--bb-grid-size-9);
        --selected-item-column-gap: var(--bb-grid-size);
        --selected-item-height: var(--bb-grid-size-9);
        --selected-item-hover-color: var(--bb-neutral-50);
        --selected-item-border-radius: var(--bb-grid-size-2);
        --selected-item-font: 400 var(--bb-label-large) /
          var(--bb-label-line-height-large) var(--bb-font-family);
        --selected-item-title-padding: 0 var(--bb-grid-size-2) 0 0;
      }
    `,
  ];

  @state()
  accessor #shapes: Shape[] = [];

  @state()
  accessor #currentShape: Shape | null = null;

  @query("svg")
  accessor #svg: SVGElement | null = null;

  #bounds: DOMRect = new DOMRect();
  #adjustment = new DOMPoint();

  @state()
  set mode(mode: RenderMode) {
    this.#mode = mode;
    localStorage.setItem("drawable-mode", mode);
  }
  get mode() {
    return this.#mode;
  }

  #mode: RenderMode = "free";

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

  constructor() {
    super();

    this.#mode =
      (localStorage.getItem("drawable-mode") as RenderMode) ?? "free";
  }

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

    switch (this.#mode) {
      case "free": {
        this.#currentShape = {
          type: "free",
          value: `M ${x} ${y}`,
        };
        break;
      }

      case "rect": {
        this.#currentShape = {
          type: "rect",
          value: {
            bx: x,
            by: y,
            sx: x,
            sy: y,
            dx: 0,
            dy: 0,
          },
        };
        break;
      }

      case "line": {
        this.#currentShape = {
          type: "line",
          value: { sx: x, sy: y, dx: 0, dy: 0 },
        };
        break;
      }
    }
  }

  #draw(e: PointerEvent) {
    const x = e.offsetX + this.#adjustment.x;
    const y = e.offsetY + this.#adjustment.y;

    if (!this.#isDrawing) return;
    switch (this.#mode) {
      case "free": {
        if (!isPath(this.#currentShape)) {
          break;
        }

        // Add a new line segment to the current path
        this.#currentShape.value += ` L ${x} ${y}`;
        break;
      }

      case "rect": {
        if (!isRect(this.#currentShape)) {
          break;
        }

        this.#currentShape.value.sx = Math.min(this.#currentShape.value.bx, x);
        this.#currentShape.value.sy = Math.min(this.#currentShape.value.by, y);

        const endX = Math.max(this.#currentShape.value.bx, x);
        const endY = Math.max(this.#currentShape.value.by, y);

        this.#currentShape.value.dx = endX - this.#currentShape.value.sx;
        this.#currentShape.value.dy = endY - this.#currentShape.value.sy;
        break;
      }

      case "line": {
        if (!isLine(this.#currentShape)) {
          break;
        }

        this.#currentShape.value.dx = x;
        this.#currentShape.value.dy = y;
        break;
      }
    }

    this.requestUpdate();
  }

  #stopDrawing(e: PointerEvent) {
    if (!this.#isDrawing) return;
    if (!this.#currentShape) return;

    if (isPath(this.#currentShape)) {
      // Adjust paths that were clicks to have a least one pixel.
      if (!this.#currentShape.value.includes("L")) {
        const x = e.offsetX + this.#adjustment.x;
        const y = e.offsetY + this.#adjustment.y;

        this.#currentShape.value += `L ${x + 1} ${y}`;
      }
    }

    this.#shapes = [...this.#shapes, this.#currentShape];
    this.#currentShape = null;
    this.#isDrawing = false;
  }

  #renderCurrentPath() {
    if (!this.#currentShape) return nothing;
    return this.#renderShape(this.#currentShape);
  }

  #renderShape(shape: Shape) {
    if (isPath(shape)) {
      return svg`<path stroke="#000" fill="none" d=${shape.value} />`;
    } else if (isRect(shape)) {
      if (shape.value.dx === 0 && shape.value.dy === 0) {
        return nothing;
      }

      return svg`<rect stroke-width="2" stroke="#000" fill="#fff"
        x=${shape.value.sx}
        y=${shape.value.sy}
        width=${shape.value.dx}
        height=${shape.value.dy}
        rx="4"
      />`;
    } else if (isLine(shape)) {
      if (shape.value.dx === 0 && shape.value.dy === 0) {
        return nothing;
      }

      const path = `M ${shape.value.sx} ${shape.value.sy} L ${shape.value.dx} ${shape.value.dy}`;
      return svg`<path stroke="#000" fill="none" d=${path} />`;
    }
  }

  render() {
    // By setting the viewBox to the element's current client dimensions, we create
    // a 1:1 mapping between pixel coordinates and SVG user units. This makes the
    // drawing responsive: if the element is resized, the SVG content scales correctly.
    return html`${svg`
      <svg
        viewBox="${this.#adjustment.x} ${this.#adjustment.y} ${this.#bounds.width} ${this.#bounds.height}"
        @pointerdown=${this.#startDrawing}
        @pointermove=${this.#draw}
        @pointerup=${this.#stopDrawing}
        @pointerleave=${this.#stopDrawing}
      >
        ${this.#shapes.map((shape) => this.#renderShape(shape))}
        ${this.#renderCurrentPath()}
      </svg>
    `}
      <div id="controls">
        <item-select
          @change=${(e: Event) => {
            if (!(e.target instanceof ItemSelect)) {
              return;
            }

            this.mode = e.target.value as RenderMode;
          }}
          .values=${values}
          .value=${this.mode}
        ></item-select>

        <button
          @click=${() => {
            this.clear();
          }}
        >
          <span class="g-icon filled round">delete</span> Clear
        </button>
      </div> `;
  }

  /**
   * Clears all drawings from the canvas.
   */
  public clear() {
    this.#shapes.length = 0;
    this.#currentShape = null;
  }

  /**
   * Exports the drawing as an Image element.
   */
  public async getValue(): Promise<HTMLImageElement> {
    const svgEl = this.#svg;
    if (!svgEl) {
      throw new Error("SVG element not found.");
    }

    const { width, height } = this.getBoundingClientRect();
    if (width === 0 || height === 0) {
      throw new Error("Canvas has zero dimensions, cannot generate image.");
    }

    const adjustedWidth = width * 1.5;
    const adjustedHeight = height * 1.5;

    // Clone the SVG to avoid modifying the original
    const svgClone = svgEl.cloneNode(true) as SVGElement;
    svgClone.setAttribute("width", `${adjustedWidth}px`);
    svgClone.setAttribute("height", `${adjustedHeight}px`);

    const svgString = new XMLSerializer().serializeToString(svgClone);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not get 2D canvas context.");
    }

    canvas.width = adjustedWidth;
    canvas.height = adjustedHeight;

    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(0, 0, adjustedWidth, adjustedHeight);

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const svgImage = new Image();
      svgImage.onload = () => {
        ctx.drawImage(svgImage, 0, 0, adjustedWidth, adjustedHeight);
        URL.revokeObjectURL(svgImage.src);

        const img = new Image();
        img.src = canvas.toDataURL("image/jpeg", 85);

        resolve(img);
      };
      svgImage.onerror = (err) => {
        URL.revokeObjectURL(svgImage.src);
        reject(new Error(`Failed to load SVG into image: ${err}`));
      };

      // Convert the SVG string to a Blob and create a URL to use as the image source
      const svgBlob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      svgImage.src = URL.createObjectURL(svgBlob);
    });
  }
}
