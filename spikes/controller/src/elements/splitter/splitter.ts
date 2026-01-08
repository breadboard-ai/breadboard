/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "../root";
import { isHydrating } from "../../controller/utils/hydration";
import { styleMap } from "lit/directives/style-map.js";

@customElement("ui-splitter")
export class UISplitter extends Root {
  static styles = [
    css`
      :host {
        display: block;
        width: 100%;
      }

      section {
        display: grid;
        grid-template-columns: var(--left) 10px var(--right);
        gap: 4px;
        width: 100%;
        height: 100%;

        & #left, & #right {
          height: 100%;
          overflow: hidden;
        }
      }

      #control {
        background: transparent;
        cursor: ew-resize;
        transition: background 0.3s cubic-bezier(0, 0, 0.3, 1);

        &:hover {
          background: light-dark(#eee, #333);
        }
      }
    `,
  ];

  #isDragging = false;
  #bounds = new DOMRect();

  render() {
    if (!this.controller) return nothing;

    const split = this.controller.layout.split;
    if (isHydrating(split)) return nothing;

    const left = split;
    const right = 1 - split;

    return html` <section
      style=${styleMap({ "--left": `${left}fr`, "--right": `${right}fr` })}
    >
      <div id="left"><slot name="s0"></slot></div>
      <div
        id="control"
        @pointerdown=${(evt: PointerEvent) => {
          (evt.target as HTMLElement).setPointerCapture(evt.pointerId);
          this.#isDragging = true;
          this.#bounds = this.getBoundingClientRect();
        }}
        @pointermove=${(evt: PointerEvent) => {
          if (!this.#isDragging) return;
          this.controller.layout.setSplit(
            (evt.pageX - this.#bounds.x) / this.#bounds.width
          );
        }}
        @pointerup=${() => {
          this.#isDragging = false;
        }}
      ></div>
      <div id="right"><slot name="s1"></slot></div>
    </section>`;
  }
}
