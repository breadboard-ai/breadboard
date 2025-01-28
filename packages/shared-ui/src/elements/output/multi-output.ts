/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { OutputValues } from "@breadboard-ai/types";
import {
  isImageURL,
  isLLMContent,
  isLLMContentArray,
} from "@google-labs/breadboard";
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { markdown } from "../../directives/markdown";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";

@customElement("bb-multi-output")
export class MultiOutput extends LitElement {
  @property()
  accessor outputs: OutputValues | null = null;

  @property()
  accessor message = "No outputs provided";

  static styles = css`
    :host {
      display: block;
      color: var(--bb-neutral-900);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    .output {
      --output-border-width: 0;
      --output-border-radius: 0;
      --output-padding: var(--bb-grid-size-6);
      --output-value-margin-x: 0;
      --output-value-margin-y: 0;
      --output-value-padding-x: 0;
      --output-value-padding-y: 0;

      .value {
        display: flex;
        flex-direction: column;
        position: relative;

        margin: 0 var(--output-value-margin-x, var(--bb-grid-size-3));
        font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        color: var(--bb-neutral-900);

        padding: 0 var(--output-value-padding-x, var(--bb-grid-size-3));

        white-space: normal;
        border-radius: initial;
        user-select: text;

        &:has(> img),
        &:has(> video),
        &:has(> audio) {
          justify-content: center;
          align-items: center;
          padding: var(--bb-grid-size-2) 0;
        }

        & img,
        & video,
        & audio {
          width: 100%;
          max-width: 360px;
        }

        & img,
        & video,
        & iframe.html-view {
          outline: 1px solid var(--bb-neutral-300);
          border-radius: var(--bb-grid-size);
        }

        & iframe.html-view {
          border: none;
          width: 100%;
          height: 600px;
        }

        & .plain-text {
          white-space: pre;
          font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family-mono);
          color: var(--bb-neutral-600);
        }

        &.markdown {
          line-height: 1.5;
          overflow-x: auto;

          & a {
            color: var(--bb-ui-700);
          }
        }

        & * {
          margin: var(--bb-grid-size) 0;
        }

        & h1 {
          font: 500 var(--bb-title-large) / var(--bb-title-line-height-large)
            var(--bb-font-family);

          margin: var(--bb-grid-size-6) 0 var(--bb-grid-size-2) 0;
        }

        & h2 {
          font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
            var(--bb-font-family);

          margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;
        }

        & h3,
        & h4,
        & h5 {
          font: 500 var(--bb-title-small) / var(--bb-title-line-height-small)
            var(--bb-font-family);

          margin: var(--bb-grid-size-3) 0 var(--bb-grid-size-2) 0;
        }

        & p {
          font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);

          margin: 0 0 var(--bb-grid-size-2) 0;
          white-space: pre-line;

          & strong:only-child {
            margin: var(--bb-grid-size-2) 0 0 0;
          }
        }

        & h1:first-of-type,
        & h2:first-of-type,
        & h3:first-of-type,
        & h4:first-of-type,
        & h5:first-of-type {
          margin-top: 0;
        }

        & p:last-of-type {
          margin-bottom: 0;
        }

        &.no-data {
          font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family-mono);
        }
      }
    }

    bb-llm-output-array {
      --export-x: 0;
      padding-top: var(--bb-grid-size-2);
    }
  `;

  render() {
    if (!this.outputs) {
      return html`${this.message}`;
    }

    return html`${map(Object.values(this.outputs), (outputValue) => {
      let value: HTMLTemplateResult | symbol = nothing;
      if (typeof outputValue === "object") {
        if (isLLMContentArray(outputValue)) {
          value = html`<bb-llm-output-array
            .clamped=${false}
            .showModeToggle=${false}
            .showEntrySelector=${false}
            .showExportControls=${true}
            .values=${outputValue}
          ></bb-llm-output-array>`;
        } else if (isLLMContent(outputValue)) {
          if (!outputValue.parts) {
            // Special case for "$metadata" item.
            // See https://github.com/breadboard-ai/breadboard/issues/1673
            // TODO: Make this not ugly.
            const data = (outputValue as unknown as { data: unknown }).data;
            value = html`<bb-json-tree .json=${data}></bb-json-tree>`;
          }

          if (!outputValue.parts.length) {
            value = html`No data provided`;
          }

          value = outputValue.parts.length
            ? html`<bb-llm-output
                .clamped=${false}
                .lite=${true}
                .showExportControls=${true}
                .value=${outputValue}
              ></bb-llm-output>`
            : html`No data provided`;
        } else if (isImageURL(outputValue)) {
          value = html`<img src=${outputValue.image_url} />`;
        } else {
          value = html`<bb-json-tree .json=${outputValue}></bb-json-tree>`;
        }
      } else {
        let renderableValue: HTMLTemplateResult | symbol = nothing;
        if (typeof outputValue === "string") {
          renderableValue = html`${markdown(outputValue)}`;
        } else {
          renderableValue = html`${outputValue !== undefined
            ? outputValue
            : html`<span class="no-value">[No value provided]</span>`}`;
        }

        // prettier-ignore
        value = html`<div
                      class=${classMap({
                        value: true,
                      })}
                    >${renderableValue}</div>`;
      }

      return html` <div class="output">
        <div class="value">${value}</div>
      </div>`;
    })}`;
  }
}
