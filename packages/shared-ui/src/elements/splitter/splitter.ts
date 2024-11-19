/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, PropertyValueMap } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

export enum Direction {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

const STORAGE_PREFIX = "bb-split";
const AUTOMATED_MOVEMENT_DURATION = 300;

@customElement("bb-splitter")
export class Splitter extends LitElement {
  @property({ reflect: true, attribute: true })
  direction = Direction.HORIZONTAL;

  @property({ reflect: true, attribute: true })
  name = "";

  @property({ reflect: true, attribute: true, type: "number" })
  minSegmentSizeHorizontal = 360;

  @property({ reflect: true, attribute: true, type: "number" })
  minSegmentSizeVertical = 200;

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

  @property({ reflect: true })
  showQuickExpandCollapse = false;

  #quickExpandRef: Ref<HTMLButtonElement> = createRef();
  #handleIdx: number | null = null;
  #bounds = new DOMRect(0, 0, 0, 0);
  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onPointerUpBound = this.#onPointerUp.bind(this);
  #isMovingAutomatically = false;
  #minSizeNormalized = 0.1;

  static styles = css`
    :host {
      display: grid;
      grid-auto-rows: minmax(0, 1fr);
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

    :host([showQuickExpandCollapse="false"]) #quick-expand {
      display: none;
    }

    :host([direction="horizontal"]) #quick-expand {
      right: calc(var(--handle-size) * 0.5);
      top: 11px;
    }

    :host([direction="vertical"]) #quick-expand {
      bottom: calc(var(--handle-size) * 0.5);
      left: 50%;
      transform: translateX(-50%) rotate(90deg);
    }
  `;

  #resizeObserver = new ResizeObserver((entries) => {
    if (entries.length === 0) {
      return;
    }

    const [entry] = entries;
    if (this.direction === Direction.HORIZONTAL) {
      this.#minSizeNormalized =
        this.minSegmentSizeHorizontal / entry.contentRect.width;
    } else {
      this.#minSizeNormalized =
        this.minSegmentSizeVertical / entry.contentRect.height;
    }

    this.#setAndStore();
  });

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#resizeObserver.disconnect();
  }

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
      case Direction.HORIZONTAL: {
        x = this.#clamp(
          x,
          this.#minSizeNormalized,
          1 - this.#minSizeNormalized
        );
        this.split[this.#handleIdx] = x * total;
        this.split[this.#handleIdx + 1] = (1 - x) * total;
        break;
      }

      case Direction.VERTICAL: {
        y = this.#clamp(
          y,
          this.#minSizeNormalized,
          1 - this.#minSizeNormalized
        );
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
    // Here we take a copy of the actual split values and we clamp them.
    // We do so by stepping through each item in the split. We accumulate the
    // delta for each item that is smaller than the minimum size, so that we
    // know how much we'd need to "borrow" from the other segments to make it
    // work. We then adjust each of the items that are too small up to the
    // minimum size.
    const split = [...this.split];
    const borrowable: number[] = [];
    let amountToBeBorrowed = 0;
    for (let s = 0; s < split.length; s++) {
      if (split[s] < this.#minSizeNormalized) {
        amountToBeBorrowed += this.#minSizeNormalized - split[s];
        split[s] = this.#minSizeNormalized;
        continue;
      }

      borrowable.push(s);
    }

    if (amountToBeBorrowed > 0) {
      // Now we go through all the other segments from which we determined that
      // we could borrow. We reduce each one by a fractional amount of the total.
      const totalBorrowable = borrowable.reduce(
        (prev, curr) => prev + split[curr],
        0
      );
      for (let s = 0; s < borrowable.length; s++) {
        const proportion =
          (split[borrowable[s]] / totalBorrowable) * amountToBeBorrowed;

        // Now ensure that the borrowed item never dips below the min size,
        // either. This could result in competition at very small spaces.
        split[borrowable[s]] = this.#clamp(
          this.split[borrowable[s]] - proportion,
          this.#minSizeNormalized,
          1
        );
      }
    }

    // Finally, we normalize the split to make sure it never exceeds 1.
    const total = split.reduce((prev, curr) => prev + curr, 0);
    for (let s = 0; s < split.length; s++) {
      split[s] = split[s] / total;
    }

    // And apply.
    const styles = split.map((_, idx) => `var(--slot-${idx})`).join(` 0px `);
    switch (this.direction) {
      case Direction.VERTICAL: {
        this.style.gridTemplateColumns = "";
        this.style.gridTemplateRows = styles;
        break;
      }

      case Direction.HORIZONTAL: {
        this.style.gridTemplateRows = "";
        this.style.gridTemplateColumns = styles;
        break;
      }
    }

    for (let idx = 0; idx < split.length; idx++) {
      const splitAmount = split[idx];
      this.style.setProperty(`--slot-${idx}`, `${splitAmount}fr`);
    }

    if (!this.#quickExpandRef.value) {
      return;
    }

    const wouldCollapseIfClicked = split[0] < 1 - this.#minSizeNormalized;
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
      | PropertyValueMap<{ direction: Direction }>
      | Map<PropertyKey, unknown>
  ): void {
    if (!changedProperties.has("direction")) {
      return;
    }

    this.#updateStyles();
  }

  render() {
    const quickExpandClass =
      this.split[0] <= 1 - this.#minSizeNormalized ? "collapse" : "expand";
    return html`${this.split.map((_, idx) => {
      const quickExpand =
        idx < this.split.length - 1 && this.split.length === 2
          ? html`<button
              id="quick-expand"
              ${ref(this.#quickExpandRef)}
              class=${classMap({ [quickExpandClass]: true })}
              @click=${() => {
                if (this.split[0] < 1 - this.#minSizeNormalized) {
                  this.#splitTo(1 - this.#minSizeNormalized);
                } else {
                  this.#splitTo(this.#minSizeNormalized);
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
