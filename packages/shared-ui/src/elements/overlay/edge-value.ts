/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, HTMLTemplateResult } from "lit";
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

/** To be kept in line with the CSS values below. */
const MAX_WIDTH = 400;
const OVERLAY_CLEARANCE = 40;

@customElement("bb-edge-value-overlay")
export class EdgeValueOverlay extends LitElement {
  @property()
  edgeValue: EdgeValueConfiguration | null = null;

  #overlayRef: Ref<Overlay> = createRef();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
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

    #content {
      width: 400px;
      max-height: 400px;
      overflow-y: auto;
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
  `;

  protected firstUpdated(): void {
    requestAnimationFrame(() => {
      if (!this.#overlayRef.value || !this.edgeValue) {
        return;
      }

      const { contentHeight } = this.#overlayRef.value;
      let { x, y } = this.edgeValue;
      x += OVERLAY_CLEARANCE;
      y -= contentHeight / 2;

      if (x + MAX_WIDTH > window.innerWidth) {
        x = window.innerWidth - MAX_WIDTH - OVERLAY_CLEARANCE;
      }

      if (y + contentHeight > window.innerHeight) {
        y = window.innerHeight - contentHeight - OVERLAY_CLEARANCE;
      }

      if (y < 0) {
        y = OVERLAY_CLEARANCE;
      }

      this.#overlayRef.value.style.setProperty("--x", `${Math.round(x)}px`);
      this.#overlayRef.value.style.setProperty("--y", `${Math.round(y)}px`);
    });
  }

  render() {
    if (!this.edgeValue || !this.edgeValue.value) {
      return nothing;
    }

    console.log("💖 edge value schema", this.edgeValue.schema);

    return html`<bb-overlay ${ref(this.#overlayRef)} inline>
      <h1>Value Inspector</h1>
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
                  const data = (edgeValue as unknown as { data: unknown }).data;
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
                value = html`<bb-json-tree .json=${edgeValue}></bb-json-tree>`;
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
    </bb-overlay>`;
  }
}
