/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, PropertyValueMap } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

export enum DIRECTION {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

const STORAGE_PREFIX = "bb-split";
const AUTOMATED_MOVEMENT_DURATION = 300;

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

  @property({
    reflect: true,
    attribute: true,
    type: Array,
    hasChanged(value) {
      if (!Array.isArray(value) || value.length < 2) {
        console.warn(
          `A quick expand/collapse needs two values: one for expand, the other for collapse; ${JSON.stringify(
            value
          )} was provided`
        );
        return false;
      }

      return true;
    },
  })
  quickExpandCollapse = [0.2, 0.8];
  showQuickExpandCollapse = false;

  #quickExpandRef: Ref<HTMLButtonElement> = createRef();
  #handleIdx: number | null = null;
  #bounds = new DOMRect(0, 0, 0, 0);
  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onPointerUpBound = this.#onPointerUp.bind(this);
  #isMovingAutomatically = false;

  static styles = css`
    :host {
      display: grid;
      overflow: auto;
      --handle-size: 16px;
      position: relative;
    }

    .drag-handle {
      z-index: 10;
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

    #quick-expand {
      position: absolute;
      width: 36px;
      height: 36px;
      font-size: 0;
      cursor: pointer;
      border: 1px solid var(--bb-neutral-300);
      border-radius: 50% 0 0 50%;
    }

    #quick-expand.expand {
      background: #fff var(--bb-icon-before) center center / 16px 16px no-repeat;
    }

    #quick-expand.collapse {
      background: #fff var(--bb-icon-next) center center / 16px 16px no-repeat;
    }

    :host([direction="horizontal"]) #quick-expand {
      right: calc(var(--handle-size) * 0.5);
      top: 3%;
    }

    :host([direction="vertical"]) #quick-expand {
      bottom: calc(var(--handle-size) * 0.5);
      left: 50%;
      transform: translateX(-50%) rotate(90deg);
    }
  `;

  #ease(v: number, pow = 3) {
    return 1 - Math.pow(1 - v, pow);
  }

  #splitTo(target: number) {
    if (this.split.length !== 2) {
      return;
    }

    this.#isMovingAutomatically = true;
    const startTime = window.performance.now();
    const start = this.split[0];
    const delta = target - this.split[0];

    const update = () => {
      const normalizedTickTime =
        (window.performance.now() - startTime) / AUTOMATED_MOVEMENT_DURATION;
      const tick = this.#clamp(normalizedTickTime, 0, 1);

      this.split[0] = start + delta * this.#ease(tick);
      this.split[1] = 1 - this.split[0];

      if (tick === 1) {
        this.split[0] = target;
        this.split[1] = 1 - target;
        this.#isMovingAutomatically = false;
      } else {
        requestAnimationFrame(update);
      }

      this.#setAndStore();
    };

    requestAnimationFrame(update);
  }

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
    if (this.#isMovingAutomatically) {
      return;
    }

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

    handle.setPointerCapture(evt.pointerId);
    window.addEventListener("pointermove", this.#onPointerMoveBound);
    window.addEventListener("pointerup", this.#onPointerUpBound, {
      once: true,
    });
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

    window.removeEventListener("pointermove", this.#onPointerMoveBound);
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

    if (!this.#quickExpandRef.value) {
      return;
    }

    const wouldCollapseIfClicked = this.split[0] < this.quickExpandCollapse[1];
    this.#quickExpandRef.value.classList.toggle(
      "collapse",
      wouldCollapseIfClicked
    );
    this.#quickExpandRef.value.classList.toggle(
      "expand",
      !wouldCollapseIfClicked
    );
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{ direction: DIRECTION }>
      | Map<PropertyKey, unknown>
  ): void {
    if (!changedProperties.has("direction")) {
      return;
    }

    this.#updateStyles();
  }

  render() {
    const quickExpandClass =
      this.split[0] < this.quickExpandCollapse[1] ? "collapse" : "expand";
    return html`${this.split.map((_, idx) => {
      const quickExpand =
        idx < this.split.length - 1 && this.split.length === 2
          ? html`<button
              id="quick-expand"
              ${ref(this.#quickExpandRef)}
              class=${classMap({ [quickExpandClass]: true })}
              @click=${() => {
                if (this.split[0] < this.quickExpandCollapse[1]) {
                  this.#splitTo(this.quickExpandCollapse[1]);
                } else {
                  this.#splitTo(this.quickExpandCollapse[0]);
                }
              }}
            >
              Quick expand
            </button>`
          : nothing;
      const handle =
        idx < this.split.length - 1
          ? html`<div
              @pointerdown=${this.#onPointerDown}
              class="drag-handle"
              data-idx="${idx}"
            >
              ${quickExpand}
            </div>`
          : nothing;
      return html`<slot name="slot-${idx}"></slot>${handle}`;
    })}`;
  }
}
