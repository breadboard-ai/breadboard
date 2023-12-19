/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ImageHandler } from "./types.js";
import {
  assertHTMLElement,
  assertInputElement,
  assertPointerEvent,
} from "./utils/assertions.js";

export class Drawable extends HTMLElement implements ImageHandler {
  #drawing = false;
  #ctx: CanvasRenderingContext2D;
  #boundFunctions = new Map<string, EventListenerOrEventListenerObject>();
  #bounds = { x: 0, y: 0 };
  #lastPosition = { x: 0, y: 0 };
  #lastDimensions = { w: 0, h: 0 };
  #strokeColor = "#333333";

  constructor(public target: HTMLCanvasElement) {
    super();

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          overflow: hidden;
          position: relative;
        }
        
        ::slotted(canvas) {
          display: block;
          width: 100%;
        }

        #controls {
          width: calc(var(--bb-grid-size) * 8);
          position: absolute;
          top: calc(var(--bb-grid-size) * 4);
          left: calc(var(--bb-grid-size) * 4);
          padding: calc(var(--bb-grid-size) * 0.5);
          background: rgb(255, 255, 255);
          border: 1px solid rgb(237, 237, 237);
          border-radius: calc(var(--bb-grid-size) * 2);
          cursor: auto;
          z-index: 1;
        }

        #controls > button#reset-image {
          background-image: var(--bb-icon-reset-image);
        }

        #controls > button:first-child {
          margin-top: 0px;
        }

        #color-input,
        #controls > button {
          width: 32px;
          height: 32px;
          font-size: 0;
          border-radius: calc(var(--bb-grid-size) * 1.5);
          border: none;
          background: none;
          display: block;
          margin-top: 4px;
          cursor: pointer;
        }

        #controls > button {
          background-color: rgb(255, 255, 255);
          background-position: center center;
          background-repeat: no-repeat;
          opacity: 0.5;
        }

        #controls > button:hover,
        #controls > button.active {
          background-color: rgb(230, 241, 242);
          opacity: 1;
        }
      </style>

      <div id="controls">
        <button id="reset-image">Reset image</button>
        <input type="color" id="color-input" value="${this.#strokeColor}" />
      </div>
      <slot></slot>
    `;

    const ctx = target.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Unable to create canvas context");
    }

    this.#ctx = ctx;

    this.#boundFunctions.set("onWindowResize", this.#onWindowResize.bind(this));
    this.#boundFunctions.set("onKeyDown", this.#onKeyDown.bind(this));
    this.#boundFunctions.set("onPointerDown", this.#onPointerDown.bind(this));
    this.#boundFunctions.set("onPointerMove", this.#onPointerMove.bind(this));
    this.#boundFunctions.set("onPointerUp", this.#onPointerUp.bind(this));

    this.#fillCanvas();

    this.appendChild(this.target);

    const resetImage = root.querySelector("#reset-image");
    assertHTMLElement(resetImage);
    resetImage.addEventListener("click", () => {
      this.#fillCanvas();
    });

    const colorInput = root.querySelector("#color-input");
    assertInputElement(colorInput);
    colorInput.addEventListener("input", () => {
      if (!colorInput.value) {
        return;
      }

      this.#strokeColor = colorInput.value;
    });
  }

  #onWindowResize() {
    const { width, height } = this.target.getBoundingClientRect();

    // Preserve the image during the resize.
    let imageData: ImageData | null = null;
    if (this.#lastDimensions.w !== 0 && this.#lastDimensions.h !== 0) {
      imageData = this.#ctx.getImageData(
        0,
        0,
        this.#lastDimensions.w,
        this.#lastDimensions.h
      );
    }

    this.target.width = width;
    this.target.height = height;

    this.#lastDimensions.w = width;
    this.#lastDimensions.h = height;

    this.#fillCanvas();

    if (imageData !== null) {
      this.#ctx.putImageData(imageData, 0, 0);
    }
  }

  #onKeyDown(evt: Event) {
    const keyEvt = evt as KeyboardEvent;
    if (keyEvt.key !== "Escape") {
      return;
    }

    this.#fillCanvas();
  }

  #onPointerDown(evt: Event) {
    assertPointerEvent(evt);

    if (evt.composedPath()[0] !== this.target) {
      return;
    }

    this.#drawing = true;

    const { width, height, x, y } = this.target.getBoundingClientRect();

    if (this.#lastDimensions.w !== width || this.#lastDimensions.h !== height) {
      this.#onWindowResize();
    }

    this.#bounds.x = x;
    this.#bounds.y = y;

    this.#ctx.strokeStyle = this.#strokeColor;
    this.#ctx.lineCap = "round";
    this.#ctx.lineWidth = 3;

    const startX = evt.pageX - this.#bounds.x;
    const startY = evt.pageY - this.#bounds.y;
    this.#ctx.beginPath();
    this.#ctx.moveTo(startX, startY);

    this.#lastPosition.x = startX;
    this.#lastPosition.y = startY;
  }

  #onPointerUp(evt: Event) {
    assertPointerEvent(evt);
    if (!this.#drawing) {
      return;
    }

    this.#drawing = false;
    this.#ctx.closePath();
  }

  #onPointerMove(evt: Event) {
    assertPointerEvent(evt);

    if (!this.#drawing) {
      return;
    }

    this.#ctx.moveTo(this.#lastPosition.x, this.#lastPosition.y);

    const x = evt.pageX - this.#bounds.x;
    const y = evt.pageY - this.#bounds.y;

    this.#ctx.lineTo(x, y);
    this.#ctx.stroke();

    this.#lastPosition.x = x;
    this.#lastPosition.y = y;
  }

  #fillCanvas() {
    this.#ctx.fillStyle = "#FFF";
    this.#ctx.fillRect(0, 0, this.#lastDimensions.w, this.#lastDimensions.h);
  }

  #getListener(name: string): EventListenerOrEventListenerObject {
    const listener = this.#boundFunctions.get(name);
    if (!listener) {
      throw new Error(`Listener ${name} does not exist`);
    }
    return listener;
  }

  async start() {
    const onWindowResize = this.#getListener("onWindowResize");
    const onKeyDown = this.#getListener("onKeyDown");
    const onPointerDown = this.#getListener("onPointerDown");
    const onPointerMove = this.#getListener("onPointerMove");
    const onPointerUp = this.#getListener("onPointerUp");

    window.addEventListener("resize", onWindowResize);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  stop() {
    const onWindowResize = this.#getListener("onWindowResize");
    const onKeyDown = this.#getListener("onKeyDown");
    const onPointerDown = this.#getListener("onPointerDown");
    const onPointerMove = this.#getListener("onPointerMove");
    const onPointerUp = this.#getListener("onPointerUp");

    window.removeEventListener("resize", onWindowResize);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  }
}
