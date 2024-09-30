/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LitElement,
  html,
  css,
  nothing,
  HTMLTemplateResult,
  PropertyValues,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { EdgeValueConfiguration } from "../../types/types.js";
import { Overlay } from "./overlay.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { OverlayDismissedEvent } from "../../events/events.js";
import { map } from "lit/directives/map.js";
import { isLLMContent, isLLMContentArray } from "@google-labs/breadboard";
import { markdown } from "../../directives/markdown.js";
import { classMap } from "lit/directives/class-map.js";
import { isImageURL } from "../../utils/llm-content.js";

const OVERLAY_CLEARANCE = 60;
const MAXIMIZE_KEY = "bb-edge-value-overlay-maximized";

@customElement("bb-edge-value-overlay")
export class EdgeValueOverlay extends LitElement {
  @property()
  edgeValue: EdgeValueConfiguration | null = null;

  @property({ reflect: true })
  maximized = false;

  #overlayRef: Ref<Overlay> = createRef();

  #minimizedX = 0;
  #minimizedY = 0;
  #left: number | null = null;
  #top: number | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: fixed;
      z-index: 20;
    }

    h1 {
      width: 100%;
      display: flex;
      align-items: center;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
      margin: 0;
      text-align: left;
      border-bottom: 1px solid var(--bb-neutral-300);
      user-select: none;
      cursor: pointer;
    }

    h1::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-eye) center center / 20px 20px
        no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    h1 span {
      flex: 1;
    }

    #content {
      width: 100%;
      max-height: none;
      flex: 1;
      overflow-y: auto;
    }

    #wrapper {
      min-width: 300px;
      width: 400px;
      display: flex;
      flex-direction: column;
      resize: both;
      overflow: auto;
    }

    :host([maximized="true"]) #wrapper {
      width: 100% !important;
      flex: 1;
    }

    #container {
      padding: var(--bb-grid-size-4) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-4);
    }

    #buttons {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4) var(--bb-grid-size-4)
        var(--bb-grid-size-4);
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }

    #close {
      background: transparent;
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-500);
      margin-right: var(--bb-grid-size-2);
    }

    #update {
      background: var(--bb-ui-500);
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-0);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-6) var(--bb-grid-size-2)
        var(--bb-grid-size-3);
      border-radius: var(--bb-grid-size-12);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #update::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-check-inverted) center center / 20px
        20px no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    #update:hover,
    #update:focus {
      background: var(--bb-ui-600);
      transition-duration: 0.1s;
    }

    #minmax {
      width: 20px;
      height: 20px;
      border: none;
      padding: 0;
      margin: 0;
      font-size: 0;
      cursor: pointer;
      background: transparent var(--bb-icon-maximize) center center / 20px 20px
        no-repeat;
    }

    #minmax.maximized {
      background: transparent var(--bb-icon-minimize) center center / 20px 20px
        no-repeat;
    }
  `;

  protected firstUpdated(): void {
    requestAnimationFrame(() => {
      if (!this.#overlayRef.value || !this.edgeValue) {
        return;
      }

      const { contentBounds } = this.#overlayRef.value;

      // We scale up by 1/0.9 because the overlay has an initial scaling down
      // factor of 0.9 for its animation which we need to correct for.
      const width = contentBounds.width / 0.9;
      const height = contentBounds.height / 0.9;

      let { x, y } = this.edgeValue;
      x += OVERLAY_CLEARANCE;
      y -= height / 2;

      if (x + width > window.innerWidth) {
        x = window.innerWidth - width - OVERLAY_CLEARANCE;
      }

      if (y + height > window.innerHeight) {
        y = window.innerHeight - height - OVERLAY_CLEARANCE;
      }

      if (y < 0) {
        y = OVERLAY_CLEARANCE;
      }

      this.#minimizedX = Math.round(x);
      this.#minimizedY = Math.round(y);

      // Once we've calculated the minimized size we can now recall the user's
      // preferred max/min and use that.
      this.maximized =
        globalThis.sessionStorage.getItem(MAXIMIZE_KEY) === "true";

      this.#overlayRef.value.style.setProperty("--left", `${Math.round(x)}px`);
      this.#overlayRef.value.style.setProperty("--top", `${Math.round(y)}px`);
    });
  }

  protected updated(changedProperties: PropertyValues): void {
    if (!changedProperties.has("maximized")) {
      return;
    }

    this.#updateOverlayContentPositionAndSize();
  }

  #updateOverlayContentPositionAndSize() {
    if (!this.#overlayRef.value) {
      return;
    }

    if (this.maximized) {
      this.#overlayRef.value.style.setProperty(
        "--left",
        `${OVERLAY_CLEARANCE}px`
      );
      this.#overlayRef.value.style.setProperty(
        "--top",
        `${OVERLAY_CLEARANCE}px`
      );
      this.#overlayRef.value.style.setProperty(
        "--right",
        `${OVERLAY_CLEARANCE}px`
      );
      this.#overlayRef.value.style.setProperty(
        "--bottom",
        `${OVERLAY_CLEARANCE}px`
      );
    } else {
      let left = this.#minimizedX;
      let top = this.#minimizedY;

      if (this.#left !== null && this.#top !== null) {
        left = this.#left;
        top = this.#top;
      }

      this.#overlayRef.value.style.setProperty("--left", `${left}px`);
      this.#overlayRef.value.style.setProperty("--top", `${top}px`);
      this.#overlayRef.value.style.setProperty("--right", "auto");
      this.#overlayRef.value.style.setProperty("--bottom", "auto");
    }
  }

  #toggleMaximize() {
    this.maximized = !this.maximized;

    globalThis.sessionStorage.setItem(MAXIMIZE_KEY, this.maximized.toString());
  }

  render() {
    if (!this.edgeValue || !this.edgeValue.value) {
      return nothing;
    }

    const contentLocationStart = { x: 0, y: 0 };
    const dragStart = { x: 0, y: 0 };
    const dragDelta = { x: 0, y: 0 };
    let dragging = false;

    return html`<bb-overlay ${ref(this.#overlayRef)} inline>
      <div id="wrapper">
        <h1
          @pointerdown=${(evt: PointerEvent) => {
            if (this.maximized) {
              return;
            }

            if (!(evt.target instanceof HTMLElement)) {
              return;
            }

            const bounds = this.#overlayRef.value?.contentBounds;
            if (!bounds) {
              return;
            }

            contentLocationStart.x = bounds.left;
            contentLocationStart.y = bounds.top;

            dragStart.x = evt.clientX;
            dragStart.y = evt.clientY;
            dragging = true;

            evt.target.setPointerCapture(evt.pointerId);
          }}
          @pointermove=${(evt: PointerEvent) => {
            if (!dragging) {
              return;
            }

            dragDelta.x = evt.clientX - dragStart.x;
            dragDelta.y = evt.clientY - dragStart.y;

            this.#left = contentLocationStart.x + dragDelta.x;
            this.#top = contentLocationStart.y + dragDelta.y;

            this.#updateOverlayContentPositionAndSize();
          }}
          @pointerup=${() => {
            dragging = false;
          }}
          @dblclick=${() => {
            this.#toggleMaximize();
          }}
        >
          <span>Value Inspector</span>
          <button
            id="minmax"
            title=${this.maximized ? "Minimize overlay" : "Maximize overlay"}
            class=${classMap({ maximized: this.maximized })}
            @click=${() => {
              this.#toggleMaximize();
            }}
          >
            ${this.maximized ? "Minimize" : "Maximize"}
          </button>
        </h1>
        <div id="content">
          <div id="container">
            ${map(this.edgeValue.value, (edgeValue) => {
              let value: HTMLTemplateResult | symbol = nothing;
              if (typeof edgeValue === "object") {
                if (isLLMContentArray(edgeValue)) {
                  value = html`<bb-llm-output-array
                    .values=${edgeValue}
                  ></bb-llm-output-array>`;
                } else if (isLLMContent(edgeValue)) {
                  if (!edgeValue.parts) {
                    // Special case for "$metadata" item.
                    // See https://github.com/breadboard-ai/breadboard/issues/1673
                    // TODO: Make this not ugly.
                    const data = (edgeValue as unknown as { data: unknown })
                      .data;
                    value = html`<bb-json-tree .json=${data}></bb-json-tree>`;
                  }

                  if (!edgeValue.parts.length) {
                    value = html`No data provided`;
                  }

                  value = edgeValue.parts.length
                    ? html`<bb-llm-output .value=${edgeValue}></bb-llm-output>`
                    : html`No data provided`;
                } else if (isImageURL(edgeValue)) {
                  value = html`<img src=${edgeValue.image_url} />`;
                } else {
                  value = html`<bb-json-tree
                    .json=${edgeValue}
                  ></bb-json-tree>`;
                }
              } else {
                let renderableValue: HTMLTemplateResult | symbol = nothing;
                if (typeof edgeValue === "string") {
                  renderableValue = html`${markdown(edgeValue)}`;
                } else {
                  renderableValue = html`${edgeValue !== undefined
                    ? edgeValue
                    : "No value provided"}`;
                }

                // prettier-ignore
                value = html`<div
                class=${classMap({
                  markdown: typeof edgeValue === 'string',
                  value: true,
                })}
              >${renderableValue}</div>`;
              }

              return html`<div>${value}</div>`;
            })}
          </div>
        </div>
        <div id="buttons">
          <button
            id="close"
            @click=${() => {
              this.dispatchEvent(new OverlayDismissedEvent());
            }}
          >
            Close
          </button>
        </div>
      </div>
    </bb-overlay>`;
  }
}
