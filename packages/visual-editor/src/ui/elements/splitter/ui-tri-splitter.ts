/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { type SCA } from "../../../sca/sca.js";
import { scaContext } from "../../../sca/context/context.js";

@customElement("ui-tri-splitter")
export class UITriSplitter extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    css`
      :host {
        display: grid;
        grid-auto-rows: minmax(0, 1fr);
        overflow: auto;
        height: 100%;
        position: relative;
        container-type: size;
        contain: strict;
      }

      section {
        display: grid;
        grid-template-columns: var(--left) var(--center) var(--right);
        width: 100%;
        height: 100%;

        & #left,
        & #center,
        & #right {
          height: 100%;
          position: relative;
          overflow: hidden;
        }

        & #left {
          border-right: 1px solid light-dark(var(--n-90), var(--n-70));
        }

        & #right {
          border-left: 1px solid light-dark(var(--n-90), var(--n-70));
        }
      }

      #control-overlay {
        position: absolute;
        display: grid;
        grid-template-columns: var(--left) var(--center) var(--right);
        inset: 0;
        top: 0;
        left: 0;
        z-index: 40;
        pointer-events: none;

        & #control-0,
        & #control-1 {
          position: relative;

          & #control-bar-0,
          & #control-bar-1 {
            pointer-events: auto;
            position: absolute;
            height: 100%;
            width: 16px;
            top: 0;
            background: transparent;
            right: -8px;
            z-index: 20;
            cursor: ew-resize;
          }
        }
      }
    `,
  ];

  #activeHandle: number | null = null;
  #bounds = new DOMRect();
  #resizeObserver = new ResizeObserver(([entry]) => {
    this.#bounds = entry.contentRect;
    this.requestUpdate();
  });

  connectedCallback(): void {
    super.connectedCallback();
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
  }

  #onDragStart(evt: PointerEvent, handleIdx: number) {
    const target = evt.target as HTMLElement;
    target.setPointerCapture(evt.pointerId);
    this.#activeHandle = handleIdx;
    this.#bounds = this.getBoundingClientRect();
    evt.preventDefault();
  }

  #onDragMove(evt: PointerEvent, handleIdx: number) {
    if (this.#activeHandle !== handleIdx) return;
    const x = (evt.pageX - this.#bounds.x) / this.#bounds.width;

    const splits = [...this.sca.controller.editor.workbench.splits];
    const total = splits[0] + splits[1] + splits[2];

    const left = splits[0] / total;
    const right = splits[2] / total;

    const W = this.#bounds.width;
    const minLeft = 200 / W;
    const minCenter = 360 / W;
    const minRight = 200 / W;

    if (handleIdx === 0) {
      const clampedX = Math.max(minLeft, Math.min(x, 1 - right - minCenter));
      const newLeft = clampedX;
      const newCenter = 1 - clampedX - right;

      this.sca.actions.workbench.resizeColumns([
        newLeft * total,
        newCenter * total,
        right * total,
      ]);
    } else {
      const clampedX = Math.max(left + minCenter, Math.min(x, 1 - minRight));
      const newCenter = clampedX - left;
      const newRight = 1 - clampedX;

      this.sca.actions.workbench.resizeColumns([
        left * total,
        newCenter * total,
        newRight * total,
      ]);
    }
  }

  #onDragEnd(_evt: PointerEvent, handleIdx: number) {
    if (this.#activeHandle === handleIdx) {
      this.#activeHandle = null;
    }
  }

  render() {
    if (!this.sca.controller) return nothing;

    const splits = this.sca.controller.editor.workbench.splits;
    const total = splits[0] + splits[1] + splits[2];
    const left = splits[0] / total;
    const center = splits[1] / total;
    const right = splits[2] / total;

    return html` <section
      style=${styleMap({
        "--left": `${left}fr`,
        "--center": `${center}fr`,
        "--right": `${right}fr`,
      })}
    >
      <div id="left">
        <slot name="s0"></slot>
      </div>
      <div id="center">
        <slot name="s1"></slot>
      </div>
      <div id="right">
        <slot name="s2"></slot>
      </div>
      <div id="control-overlay">
        <div id="control-0">
          <div
            id="control-bar-0"
            @pointerdown=${(evt: PointerEvent) => this.#onDragStart(evt, 0)}
            @pointermove=${(evt: PointerEvent) => this.#onDragMove(evt, 0)}
            @pointerup=${(evt: PointerEvent) => this.#onDragEnd(evt, 0)}
          ></div>
        </div>
        <div id="control-1">
          <div
            id="control-bar-1"
            @pointerdown=${(evt: PointerEvent) => this.#onDragStart(evt, 1)}
            @pointermove=${(evt: PointerEvent) => this.#onDragMove(evt, 1)}
            @pointerup=${(evt: PointerEvent) => this.#onDragEnd(evt, 1)}
          ></div>
        </div>
        <div></div>
      </div>
    </section>`;
  }
}
