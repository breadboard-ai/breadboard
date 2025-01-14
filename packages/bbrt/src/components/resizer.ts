/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { draggable, type DraggableSize } from "../util/draggable.js";

type State =
  | { status: "initial" }
  | { status: "dragging"; initialWidth: number };

@customElement("bbrt-resizer")
export class BBRTResizer extends LitElement {
  @state()
  accessor #state: State = { status: "initial" };

  @property({ attribute: false })
  accessor target: HTMLElement | undefined = undefined;

  @property()
  accessor cssProperty: string | undefined = undefined;

  @property({ attribute: false })
  accessor cssPropertyReceiver: HTMLElement | undefined = undefined;

  @property({ type: Boolean })
  accessor reverse = false;

  static override styles = css`
    :host {
      position: relative;
      cursor: col-resize;
    }
    div::before,
    div::after {
      content: "";
      cursor: col-resize;
      position: absolute;
      width: calc(var(--bbrt-resizer-touch-area, 16px) / 2);
      height: 100%;
      background: transparent;
      box-sizing: border-box;
    }
    div::before {
      left: calc(var(--bbrt-resizer-touch-area, 16px) / -2);
      border-right: calc(var(--bbrt-resizer-highlight-thickness, 4px) / 2) solid
        transparent;
    }
    div::after {
      left: 0;
      border-left: calc(var(--bbrt-resizer-highlight-thickness, 4px) / 2) solid
        transparent;
    }
    div:hover::before,
    div:hover::after {
      border-color: var(--bbrt-resizer-highlight-color, cyan);
    }
  `;

  override render() {
    return html`<div
      role="separator"
      ${draggable({
        start: this.#onDragStart,
        drag: this.#onDragMove,
        end: this.#onDragDone,
      })}
    ></div>`;
  }

  #onDragStart = () => {
    this.#state = {
      status: "dragging",
      initialWidth: this.target?.getBoundingClientRect().width ?? 0,
    };
  };

  #onDragMove = ({ change }: DraggableSize) => {
    if (
      this.#state.status !== "dragging" ||
      !this.cssPropertyReceiver ||
      !this.cssProperty
    ) {
      return;
    }
    const width = this.#state.initialWidth + change * (this.reverse ? -1 : 1);
    this.cssPropertyReceiver.style.setProperty(this.cssProperty, `${width}px`);
  };

  #onDragDone = () => {
    this.#state = { status: "initial" };
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-resizer": BBRTResizer;
  }
}
