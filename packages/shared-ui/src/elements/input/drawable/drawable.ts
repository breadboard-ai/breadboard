/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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

  #drawing = false;
  #moved = false;
  #canvasRef: Ref<HTMLCanvasElement> = createRef();
  #bounds: DOMRect = new DOMRect();
  #pointer: DOMPoint = new DOMPoint();
  #ctx: CanvasRenderingContext2D | null = null;

  #resizeObserver = new ResizeObserver((entries) => {
    if (!this.#canvasRef.value) {
      return;
    }

    const canvas = this.#canvasRef.value;
    const { contentRect } = entries[0];
    const ctx = this.#getCtx();
    if (!ctx) {
      return;
    }

    let { width, height } = contentRect;
    width = Math.floor(width);
    height = Math.floor(height);

    const dPR = window.devicePixelRatio;

    // Preserve the image during the resize.
    let imageData: OffscreenCanvas | null = null;
    if (this.#bounds.width !== 0 && this.#bounds.height !== 0) {
      imageData = new OffscreenCanvas(canvas.width * 1.5, canvas.height * 1.5);
      const imageDataCtx = imageData.getContext("2d");
      if (imageDataCtx) {
        imageDataCtx.imageSmoothingEnabled = true;
        imageDataCtx.imageSmoothingQuality = "high";
        imageDataCtx.drawImage(
          canvas,
          0,
          0,
          canvas.width * 1.5,
          canvas.height * 1.5
        );
      }
    }

    canvas.width = width * dPR;
    canvas.height = height * dPR;

    this.#bounds = canvas.getBoundingClientRect();
    this.#fillCanvas();

    if (imageData !== null) {
      ctx.drawImage(
        imageData,
        0,
        0,
        imageData.width,
        imageData.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    ctx.scale(dPR, dPR);
  });

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#resizeObserver.disconnect();
  }

  #getCtx() {
    if (!this.#canvasRef.value) {
      return null;
    }

    if (!this.#ctx) {
      this.#ctx = this.#canvasRef.value.getContext("2d", {
        willReadFrequently: true,
      });

      if (this.#ctx) {
        this.#ctx.imageSmoothingEnabled = true;
        this.#ctx.imageSmoothingQuality = "high";
      }
    }

    return this.#ctx;
  }

  #onColorInput(evt: InputEvent) {
    if (!(evt.target instanceof HTMLInputElement)) {
      return;
    }

    this.strokeColor = evt.target.value;
  }

  #fillCanvas() {
    const ctx = this.#getCtx();
    if (!ctx) {
      return;
    }

    ctx.fillStyle = "#FFF";
    ctx.fillRect(0, 0, this.#bounds.width, this.#bounds.height);
  }

  #onReset() {
    this.#fillCanvas();
  }

  #onPointerDown(evt: PointerEvent) {
    const ctx = this.#getCtx();
    if (!ctx) {
      return;
    }

    const [top] = evt.composedPath();
    if (!this.#canvasRef.value || top !== this.#canvasRef.value) {
      return;
    }

    (top as HTMLCanvasElement).setPointerCapture(evt.pointerId);

    this.#drawing = true;
    this.#moved = false;

    ctx.strokeStyle = this.strokeColor;
    ctx.lineCap = "round";
    ctx.lineWidth = 3;

    const startX = evt.clientX - this.#bounds.x + window.scrollX;
    const startY = evt.clientY - this.#bounds.y - window.scrollY;
    this.#pointer.x = startX;
    this.#pointer.y = startY;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX, startY);
  }

  #onPointerMove(evt: PointerEvent) {
    if (!this.#drawing) {
      return;
    }

    this.#moved = true;
    const ctx = this.#getCtx();
    if (!ctx) {
      return;
    }

    ctx.moveTo(this.#pointer.x, this.#pointer.y);

    const x = evt.clientX - this.#bounds.x + window.scrollX;
    const y = evt.clientY - this.#bounds.y - window.scrollY;

    ctx.lineTo(x, y);
    ctx.stroke();

    this.#pointer.x = x;
    this.#pointer.y = y;
  }

  #onPointerUp(evt: PointerEvent) {
    if (!this.#drawing) {
      return;
    }

    this.#drawing = false;

    const ctx = this.#getCtx();
    if (!ctx) {
      return;
    }

    if (!this.#moved) {
      ctx.moveTo(this.#pointer.x - 0.5, this.#pointer.y - 0.5);

      const x = evt.clientX - this.#bounds.x + window.scrollX;
      const y = evt.clientY - this.#bounds.y - window.scrollY;

      ctx.lineTo(x, y);
      ctx.stroke();
    }

    ctx.closePath();
  }

  @property()
  set url(url: URL | null) {
    if (!url) {
      return;
    }

    const img = new Image();
    img.src = url.href;
    img.onload = () => {
      const ctx = this.#getCtx();
      if (!ctx) {
        console.log("Unable to render");
        return;
      }

      ctx.drawImage(img, 0, 0, this.#bounds.width, this.#bounds.height);
    };
  }

  get value(): string {
    const inlineData = this.#canvasRef.value?.toDataURL(this.type, 80) || "";
    const preamble = `data:${this.type};base64,`;

    return inlineData.substring(preamble.length);
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
