/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent } from "@breadboard-ai/types";
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref, type Ref } from "lit/directives/ref.js";

@customElement("bb-drawable-input")
export class DrawableInput extends LitElement {
  @property()
  accessor type = "image/png";

  @state()
  accessor error = "";

  @state()
  accessor strokeColor = "#333333";

  #drawing = false;
  #canvasRef: Ref<HTMLCanvasElement> = createRef();
  #bounds = { x: 0, y: 0 };
  #lastPosition = { x: 0, y: 0 };
  #lastDimensions = { w: 0, h: 0 };
  #onWindowResizeBound = this.#onWindowResize.bind(this);

  static styles = css`
    :host {
      position: relative;
      display: block;
      width: 100%;
      background-color: var(--bb-neutral-0);
      border-radius: var(--bb-grid-size-3);
      aspect-ratio: 4/3;
      outline: 1px solid var(--primary-color, var(--bb-neutral-300));
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      opacity: 0;
      border-radius: var(--bb-grid-size-3);
      animation: fadeIn 0.3s cubic-bezier(0, 0, 0.3, 1) both;
      animation-delay: 0.3s;
    }

    canvas.active {
      animation: fadeIn 0.3s cubic-bezier(0, 0, 0.3, 1) both;
      animation-delay: 0.3s;
    }

    #controls {
      display: flex;
      flex-direction: column;
      position: absolute;
      top: var(--bb-grid-size-4);
      right: var(--bb-grid-size-4);
      padding: var(--bb-grid-size);
      background: var(--background-color, var(--bb-neutral-0));
      border: 1px solid var(--primary-color, var(--bb-neutral-300));
      border-radius: var(--bb-grid-size-2);
      cursor: auto;
      z-index: 1;

      & #color-input,
      & #reset-image {
        width: 20px;
        height: 20px;
        margin-bottom: var(--bb-grid-size);
        font-size: 0;
        border: none;
      }

      #color-input {
        border-radius: 50%;
        border: none;
        padding: 0;
      }

      #color-input::-webkit-color-swatch-wrapper {
        padding: 0;
        border: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
      }

      #color-input::-webkit-color-swatch {
        padding: 0;
        border: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
      }

      #color-input::-moz-color-swatch-wrapper {
        padding: 0;
        border: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
      }

      #color-input::-moz-color-swatch {
        padding: 0;
        border: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
      }

      & #reset-image {
        opacity: 0.6;
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
        background: transparent var(--bb-icon-reset-image) center center / 20px
          20px no-repeat;

        &:not([disabled]) {
          cursor: pointer;

          &:focus,
          &:hover {
            opacity: 1;
          }
        }
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("resize", this.#onWindowResizeBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("resize", this.#onWindowResizeBound);
  }

  #onColorInput(evt: InputEvent) {
    if (!(evt.target instanceof HTMLInputElement)) {
      return;
    }

    this.strokeColor = evt.target.value;
  }

  #fillCanvas() {
    if (!this.#canvasRef.value) {
      return;
    }

    const ctx = this.#canvasRef.value.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.fillStyle = "#FFF";
    ctx.fillRect(0, 0, this.#lastDimensions.w, this.#lastDimensions.h);
  }

  #onReset() {
    this.#fillCanvas();
  }

  #onWindowResize() {
    if (!this.#canvasRef.value) {
      return;
    }

    const canvas = this.#canvasRef.value;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return;
    }

    let { width, height } = canvas.getBoundingClientRect();
    width = Math.floor(width);
    height = Math.floor(height);

    // Preserve the image during the resize.
    let imageData: ImageData | null = null;
    if (this.#lastDimensions.w !== 0 && this.#lastDimensions.h !== 0) {
      imageData = ctx.getImageData(
        0,
        0,
        this.#lastDimensions.w,
        this.#lastDimensions.h
      );
    }

    canvas.width = width;
    canvas.height = height;

    this.#lastDimensions.w = width;
    this.#lastDimensions.h = height;

    this.#fillCanvas();

    if (imageData !== null) {
      ctx.putImageData(imageData, 0, 0);
    }
  }

  #onPointerDown(evt: PointerEvent) {
    if (!this.#canvasRef.value) {
      return;
    }

    const canvas = this.#canvasRef.value;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return;
    }

    if (evt.composedPath()[0] !== canvas) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const { x, y } = bounds;
    const width = Math.floor(bounds.width);
    const height = Math.floor(bounds.height);

    if (this.#lastDimensions.w !== width || this.#lastDimensions.h !== height) {
      this.#onWindowResize();
    }

    canvas.setPointerCapture(evt.pointerId);

    this.#drawing = true;
    this.#bounds.x = x;
    this.#bounds.y = y;

    ctx.strokeStyle = this.strokeColor;
    ctx.lineCap = "round";
    ctx.lineWidth = 3;

    const startX = evt.pageX - this.#bounds.x + window.scrollX;
    const startY = evt.pageY - this.#bounds.y - window.scrollY;

    ctx.beginPath();
    ctx.moveTo(startX, startY);

    this.#lastPosition.x = startX;
    this.#lastPosition.y = startY;
  }

  #onPointerUp() {
    if (!this.#drawing) {
      return;
    }

    this.#drawing = false;

    if (!this.#canvasRef.value) {
      return;
    }

    const canvas = this.#canvasRef.value;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return;
    }

    ctx.closePath();
  }

  #onPointerMove(evt: PointerEvent) {
    if (!this.#drawing) {
      return;
    }

    if (!this.#canvasRef.value) {
      return;
    }

    const canvas = this.#canvasRef.value;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return;
    }

    ctx.moveTo(this.#lastPosition.x, this.#lastPosition.y);

    const x = evt.pageX - this.#bounds.x + window.scrollX;
    const y = evt.pageY - this.#bounds.y - window.scrollY;

    ctx.lineTo(x, y);
    ctx.stroke();

    this.#lastPosition.x = x;
    this.#lastPosition.y = y;
  }

  get value(): LLMContent {
    const inlineData = this.#canvasRef.value?.toDataURL(this.type, 80) || "";
    const preamble = `data:${this.type};base64,`;

    return {
      role: "user",
      parts: [
        {
          inlineData: {
            data: inlineData.substring(preamble.length),
            mimeType: this.type,
          },
        },
      ],
    };
  }

  render() {
    if (this.error) {
      return html`${this.error}`;
    }

    return html`<div id="controls">
        <button @click=${this.#onReset} id="reset-image">Reset image</button>
        <input
          @input=${this.#onColorInput}
          type="color"
          id="color-input"
          value="${this.strokeColor}"
        />
      </div>
      <canvas
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        ${ref(this.#canvasRef)}
      ></canvas>`;
  }
}
