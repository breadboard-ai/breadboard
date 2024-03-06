/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export enum DIRECTION {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

const STORAGE_PREFIX = "bb-split";

@customElement("bb-splitter")
export class Splitter extends LitElement {
  @property({ reflect: true, attribute: true })
  direction = DIRECTION.HORIZONTAL;

  @property({ reflect: true, attribute: true })
  name = "";

  @property({ reflect: true, attribute: true, type: "number" })
  minSize = 0.1;

  @property({
    reflect: true,
    attribute: true,
    type: Array,
    hasChanged(value) {
      if (!Array.isArray(value) || value.length < 2) {
        console.warn(
          `A splitter needs two or more sections; ${JSON.stringify(
            value
          )} was provided`
        );
        return false;
      }

      return true;
    },
  })
  split = [0.5, 0.5];

  #handleIdx: number | null = null;
  #bounds = new DOMRect(0, 0, 0, 0);
  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onPointerUpBound = this.#onPointerUp.bind(this);

  static styles = css`
    :host {
      display: grid;
      overflow: auto;
      --handle-size: 16px;
    }

    .drag-handle {
      z-index: 1;
      position: relative;
    }

    :host([direction="horizontal"].active) {
      cursor: ew-resize;
    }

    :host([direction="vertical"].active) {
      cursor: ns-resize;
    }

    :host([direction="horizontal"]) .drag-handle {
      cursor: ew-resize;
      width: var(--handle-size);
      translate: calc(var(--handle-size) * -0.5) 0;
    }

    :host([direction="vertical"]) .drag-handle {
      cursor: ns-resize;
      height: var(--handle-size);
      translate: 0 calc(var(--handle-size) * -0.5);
    }
  `;

  #setAndStore() {
    if (this.name) {
      globalThis.sessionStorage.setItem(
        `${STORAGE_PREFIX}-${this.name}`,
        JSON.stringify(this.split)
      );
    }

    this.#updateStyles();
  }

  #onPointerDown(evt: PointerEvent) {
    const [handle] = evt.composedPath();
    if (!(handle instanceof HTMLElement)) {
      return;
    }

    const idx = Number.parseInt(handle.dataset.idx || "");
    if (Number.isNaN(idx)) {
      return;
    }

    this.#handleIdx = idx;
    const top = this.children[this.#handleIdx];
    const bottom = this.children[this.#handleIdx + 1];

    if (!top || !bottom) {
      return;
    }

    const start = top.getBoundingClientRect();
    const end = bottom.getBoundingClientRect();

    this.#bounds.x = Math.min(start.x, end.x);
    this.#bounds.y = Math.min(start.y, end.y);
    this.#bounds.width = end.right - start.left;
    this.#bounds.height = end.bottom - start.top;

    this.style.userSelect = "none";
    this.classList.add("active");

    document.addEventListener("pointermove", this.#onPointerMoveBound);
    document.addEventListener("pointerup", this.#onPointerUpBound);
  }

  #onPointerMove(evt: PointerEvent) {
    if (this.#handleIdx === null) {
      return;
    }

    let x = (evt.pageX - this.#bounds.x) / this.#bounds.width;
    let y = (evt.pageY - this.#bounds.y) / this.#bounds.height;

    const total = this.split[this.#handleIdx] + this.split[this.#handleIdx + 1];
    switch (this.direction) {
      case DIRECTION.HORIZONTAL: {
        x = this.#clamp(x, this.minSize, 1 - this.minSize);
        this.split[this.#handleIdx] = x * total;
        this.split[this.#handleIdx + 1] = (1 - x) * total;
        break;
      }

      case DIRECTION.VERTICAL: {
        y = this.#clamp(y, this.minSize, 1 - this.minSize);
        this.split[this.#handleIdx] = y * total;
        this.split[this.#handleIdx + 1] = (1 - y) * total;
        break;
      }
    }

    this.#setAndStore();
  }

  #onPointerUp() {
    this.#handleIdx = null;
    this.style.userSelect = "initial";
    this.classList.remove("active");
    document.removeEventListener("pointermove", this.#onPointerMoveBound);
  }

  #clamp(value: number, min: number, max: number) {
    if (value < min) {
      value = min;
    }

    if (value > max) {
      value = max;
    }

    return value;
  }

  firstUpdated() {
    if (!this.name) {
      console.warn("Splitter has no name; it won't have any values stored.");
      return;
    }

    const split = globalThis.sessionStorage.getItem(
      `${STORAGE_PREFIX}-${this.name}`
    );
    if (split) {
      const numSplit: number[] = JSON.parse(split) as number[];
      if (Array.isArray(numSplit)) {
        if (numSplit.length === this.split.length) {
          for (let i = 0; i < numSplit.length; i++) {
            this.split[i] = numSplit[i];
          }
        } else {
          console.warn(
            "Stored splitter value differs from configured value - resetting"
          );
          globalThis.sessionStorage.removeItem(
            `${STORAGE_PREFIX}-${this.name}`
          );
        }
      }
    }

    this.#updateStyles();
  }

  #updateStyles() {
    const styles = this.split
      .map((_, idx) => `var(--slot-${idx})`)
      .join(` 0px `);

    switch (this.direction) {
      case DIRECTION.VERTICAL: {
        this.style.gridTemplateColumns = "";
        this.style.gridTemplateRows = styles;
        break;
      }

      case DIRECTION.HORIZONTAL: {
        this.style.gridTemplateRows = "";
        this.style.gridTemplateColumns = styles;
        break;
      }
    }

    for (let idx = 0; idx < this.split.length; idx++) {
      const split = this.split[idx];
      this.style.setProperty(`--slot-${idx}`, `${split}fr`);
    }
  }

  render() {
    return html`${this.split.map((_, idx) => {
      const handle =
        idx < this.split.length - 1
          ? html`<div
              @pointerdown=${this.#onPointerDown}
              class="drag-handle"
              data-idx="${idx}"
            ></div>`
          : nothing;
      return html`<slot name="slot-${idx}"></slot>${handle}`;
    })}`;
  }
}
