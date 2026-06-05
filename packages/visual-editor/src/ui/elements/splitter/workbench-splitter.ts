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
import { Utils } from "../../../sca/utils.js";
import { scaContext } from "../../../sca/context/context.js";

@customElement("bb-workbench-splitter")
export class WorkbenchSplitter extends SignalWatcher(LitElement) {
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
        grid-template-columns: var(--left) var(--right);
        width: 100%;
        height: 100%;

        & #left,
        & #right {
          height: 100%;
          position: relative;
          overflow: hidden;
        }

        & #left {
          border-right: 1px solid var(--light-dark-n-90, #f1f3f4);
        }
      }

      #control-overlay {
        position: absolute;
        display: grid;
        grid-template-columns: var(--left) var(--right);
        inset: 0;
        top: 0;
        left: 0;
        z-index: 40;
        pointer-events: none;

        & #control {
          position: relative;

          & #control-bar {
            pointer-events: auto;
            position: absolute;
            height: 100%;
            width: 16px;
            top: 0;
            background: transparent;
            right: 0px;
            transform: translateX(8px);
            z-index: 20;
            cursor: ew-resize;
          }
        }

        &::after {
          content: "";
        }
      }
    `,
  ];

  #isDragging = false;
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

  render() {
    if (!this.sca.controller) return nothing;

    const splitter = this.sca.controller.editor.workbench.splitter;
    const split = splitter.split;
    if (Utils.Helpers.isHydrating(() => split)) return nothing;

    const [left, right] = splitter.getClampedValues(split, this.#bounds);

    return html` <section
      style=${styleMap({ "--left": `${left}fr`, "--right": `${right}fr` })}
    >
      <div id="left">
        <slot name="s0"></slot>
      </div>
      <div id="right">
        <slot name="s1"></slot>
      </div>
      <div id="control-overlay">
        <div id="control">
          <div
            id="control-bar"
            @pointerdown=${(evt: PointerEvent) => {
              (evt.target as HTMLElement).setPointerCapture(evt.pointerId);
              this.#isDragging = true;
              this.#bounds = this.getBoundingClientRect();
            }}
            @pointermove=${(evt: PointerEvent) => {
              if (!this.#isDragging) return;
              splitter.setSplit(
                (evt.pageX - this.#bounds.x) / this.#bounds.width
              );
            }}
            @pointerup=${() => {
              this.#isDragging = false;
            }}
          ></div>
        </div>
      </div>
    </section>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "bb-workbench-splitter": WorkbenchSplitter;
  }
}
