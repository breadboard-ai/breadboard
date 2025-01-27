/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  InspectablePort,
  InspectableRunEvent,
  isLLMContent,
  isLLMContentArray,
  OutputValues,
} from "@google-labs/breadboard";
import { LitElement, html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { until } from "lit/directives/until.js";
import { markdown } from "../../directives/markdown.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-event-details")
export class EventDetails extends LitElement {
  @property()
  accessor event: InspectableRunEvent | null = null;

  static styles = css`
    :host {
      display: block;
    }

    .item {
      margin-bottom: var(--bb-grid-size-2);
    }

    .item h1 {
      font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
        var(--bb-font-family);
      margin: var(--bb-grid-size) 0;
    }

    .item .value {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family-mono);
      color: var(--bb-inputs-700);
    }
  `;

  #isImageURL(nodeValue: unknown): nodeValue is { image_url: string } {
    if (typeof nodeValue !== "object" || !nodeValue) {
      return false;
    }

    return "image_url" in nodeValue;
  }

  render() {
    if (!this.event || this.event.type !== "node") {
      return html`No event details available`;
    }

    const { node, inputs, outputs } = this.event;
    const details = node
      .ports(inputs, outputs as OutputValues)
      .then((allPorts) => {
        const type = node.descriptor.type;
        const isOutput = type === "output";
        const portList: { ports: InspectablePort[] } = isOutput
          ? allPorts.inputs
          : allPorts.outputs;
        const ports = portList.ports.filter((port) => {
          if (port.star) return false;
          if (port.name === "$error") return false;
          if (isOutput && port.name === "schema") return false;

          return true;
        });

        return html`<div class="node-output">
          ${ports.length > 1
            ? ports.map((port, _idx, arr) => {
                const nodeValue = port.value;
                let value: HTMLTemplateResult | symbol = nothing;
                if (typeof nodeValue === "object") {
                  if (isLLMContentArray(nodeValue)) {
                    value = html`<bb-llm-output-array
                      .values=${nodeValue}
                    ></bb-llm-output-array>`;
                  } else if (isLLMContent(nodeValue)) {
                    if (!nodeValue.parts) {
                      // Special case for "$metadata" item.
                      // See https://github.com/breadboard-ai/breadboard/issues/1673
                      // TODO: Make this not ugly.
                      const data = (nodeValue as unknown as { data: unknown })
                        .data;
                      value = html`<bb-json-tree .json=${data}></bb-json-tree>`;
                    } else {
                      if (!nodeValue.parts.length) {
                        value = html`No data provided`;
                      } else {
                        value = html`<bb-llm-output
                          .value=${nodeValue}
                        ></bb-llm-output>`;
                      }
                    }
                  } else if (this.#isImageURL(nodeValue)) {
                    value = html`<img src=${nodeValue.image_url} />`;
                  } else {
                    value = html`<bb-json-tree
                      .json=${nodeValue}
                    ></bb-json-tree>`;
                  }
                } else {
                  let renderableValue: HTMLTemplateResult | symbol = nothing;
                  if (
                    port.schema.format === "markdown" &&
                    typeof nodeValue === "string"
                  ) {
                    renderableValue = html`${markdown(nodeValue)}`;
                  } else {
                    renderableValue = html`${nodeValue !== undefined
                      ? nodeValue
                      : "No value provided"}`;
                  }

                  // prettier-ignore
                  value = html`<div
                      class=${classMap({
                        markdown: port.schema.format === 'markdown',
                        value: true,
                        [type]: true,
                      })}
                    >${renderableValue}</div>`;
                }

                return html` <div class="item">
                  ${arr.length > 1 ? html`<h1>${port.title}</h1>` : nothing}
                  <div>${value}</div>
                </div>`;
              })
            : html`<bb-json-tree
                .json=${this.event}
                .autoExpand=${true}
              ></bb-json-tree>`}
        </div>`;
      });

    return html`${until(details, html`Loading data...`)}`;
  }
}
