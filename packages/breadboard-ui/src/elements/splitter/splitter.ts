/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

export enum ORIENTATION {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

const STORAGE_PREFIX = "bb-split";

@customElement("bb-splitter")
export class Splitter extends LitElement {
  @property({ reflect: true, attribute: true })
  orientation = ORIENTATION.HORIZONTAL;

  @property({ reflect: true, attribute: true })
  name = "";

  @property({ reflect: true, attribute: true, type: "number" })
  minSize = 0.1;

  #bounds: DOMRect | null = null;
  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onPointerUpBound = this.#onPointerUp.bind(this);

  static styles = css`
    :host {
      display: grid;
      --a-fr: 1fr;
      --b-fr: 1fr;
      --handle: 8px;
    }

    :host([orientation="horizontal"]) {
      grid-template-columns: var(--a-fr) var(--handle) var(--b-fr);
    }

    :host([orientation="vertical"]) {
      grid-template-rows: var(--a-fr) var(--handle) var(--b-fr);
    }

    :host([orientation="horizontal"]) #drag-handle {
      cursor: ew-resize;
    }

    :host([orientation="vertical"]) #drag-handle {
      cursor: ns-resize;
    }
  `;

  #set(size: number) {
    if (size < this.minSize) {
      size = this.minSize;
    } else if (size > 1 - this.minSize) {
      size = 1 - this.minSize;
    }

    const a = size;
    const b = 1 - size;

    if (this.name) {
      globalThis.sessionStorage.setItem(
        `${STORAGE_PREFIX}-${this.name}`,
        size.toString()
      );
    }

    this.style.setProperty("--a-fr", `${a}fr`);
    this.style.setProperty("--b-fr", `${b}fr`);
  }

  #onPointerDown() {
    this.#bounds = this.getBoundingClientRect();
    this.style.userSelect = "none";

    document.addEventListener("pointermove", this.#onPointerMoveBound);
    document.addEventListener("pointerup", this.#onPointerUpBound);
  }

  #onPointerMove(evt: PointerEvent) {
    if (!this.#bounds) {
      return;
    }

    const x = (evt.pageX - this.#bounds.left) / this.#bounds.width;
    const y = (evt.pageY - this.#bounds.top) / this.#bounds.height;

    switch (this.orientation) {
      case ORIENTATION.HORIZONTAL: {
        this.#set(x);
        break;
      }

      case ORIENTATION.VERTICAL: {
        this.#set(y);
        break;
      }
    }
  }

  #onPointerUp() {
    this.style.userSelect = "initial";
    document.removeEventListener("pointermove", this.#onPointerMoveBound);
  }

  firstUpdated() {
    if (!this.name) {
      console.warn("Splitter has no name; it won't have any values stored.");
      return;
    }

    // TODO: Restore from session storage.
    const split = globalThis.sessionStorage.getItem(
      `${STORAGE_PREFIX}-${this.name}`
    );
    if (split) {
      const numSplit = Number.parseFloat(split);
      if (Number.isNaN(numSplit)) {
        return;
      }

      this.#set(numSplit);
    }
  }

  render() {
    return html`<slot name="a"></slot>
      <div @pointerdown=${this.#onPointerDown} id="drag-handle"></div>
      <slot name="b"></slot>`;
  }
}
