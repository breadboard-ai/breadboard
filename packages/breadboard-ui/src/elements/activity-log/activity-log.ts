/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ErrorObject,
  InspectableRun,
  InspectableRunEvent,
  Schema,
} from "@google-labs/breadboard";
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { InputRequestedEvent } from "../../events/events.js";
import { map } from "lit/directives/map.js";
import { styleMap } from "lit/directives/style-map.js";

@customElement("bb-activity-log")
export class ActivityLog extends LitElement {
  @property({ reflect: false })
  events: InspectableRunEvent[] | null = null;

  @property({ reflect: true })
  eventPosition = 0;

  @property({ reflect: true })
  logTitle = "Activity Log";

  @property({ reflect: true })
  showExtendedInfo = false;

  #newestEntry: Ref<HTMLElement> = createRef();
  #isHidden = false;
  #observer = new IntersectionObserver((entries) => {
    if (entries.length === 0) {
      return;
    }

    const [entry] = entries;
    if (!entry.rootBounds) {
      return;
    }

    this.#isHidden =
      entry.rootBounds.width === 0 && entry.rootBounds.height === 0;

    if (
      !this.#isHidden &&
      this.#newestEntry.value &&
      this.#newestEntry.value.querySelector(".user-required")
    ) {
      this.#newestEntry.value.scrollIntoView(true);
      this.#newestEntry.value
        .querySelector(".user-required")
        ?.addEventListener("animationend", (evt: Event) => {
          if (!(evt.target instanceof HTMLElement)) {
            return;
          }

          evt.target.classList.remove("user-required");
        });
    }
  });

  static styles = css`
    :host {
      display: block;
      background: #fff;
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      scrollbar-gutter: stable;

      --padding-x: calc(var(--bb-grid-size) * 4);
      --padding-y: calc(var(--bb-grid-size) * 2);
    }

    :host > h1 {
      position: sticky;
      top: 0;
      font-size: var(--bb-font-medium);
      font-weight: normal;
      margin: 0 0 var(--bb-grid-size) 0;
      padding: var(--padding-x) var(--padding-x) var(--padding-y)
        var(--padding-x);
      background: white;
      z-index: 2;
    }

    :host > h1::after {
      content: "";
      width: calc(100% - var(--padding-x) * 2);
      height: 1px;
      position: absolute;
      bottom: var(--bb-grid-size);
      left: var(--padding-x);
      background: #f6f6f6;
    }

    .activity-entry {
      padding: var(--padding-y) 0;
      position: relative;
      font-size: var(--bb-font-medium);
      user-select: none;
    }

    :host > .activity-entry {
      padding-left: var(--padding-x);
      padding-right: var(--padding-x);
    }

    :host > .activity-entry:last-of-type {
      margin-bottom: 100px;
    }

    .activity-entry.error {
      color: #cc0000;
    }

    .activity-entry h1 {
      font-size: var(--bb-font-medium);
      margin: 0;
      font-weight: normal;
    }

    .activity-entry::after {
      content: "";
      width: calc(var(--bb-grid-size) * 4);
      height: calc(var(--bb-grid-size) * 4);
      border-radius: 50%;
      top: calc(var(--padding-y) + var(--bb-grid-size) - 3px);
      left: -2px;
      position: absolute;
      --background: #ffcc33;
    }

    :host > .activity-entry::after {
      left: calc(var(--padding-x) + 10px);
    }

    .activity-entry.icon::after {
      width: calc(var(--bb-grid-size) * 7);
      height: calc(var(--bb-grid-size) * 7);
      left: calc(var(--padding-x) + 3px);
      top: calc(var(--padding-y) - var(--bb-grid-size));
      background: #fff var(--node-icon) center center no-repeat;
      background-size: 20px 20px;
      border: 1px solid #d9d9d9;
    }

    .activity-entry::before {
      --top: calc(var(--padding-y) + 5px);
      content: "";
      width: 2px;
      height: 100%;
      left: 5px;
      top: 0;
      height: 100%;
      position: absolute;
      background: #d9d9d9;
    }

    :host > .activity-entry::before {
      left: calc(var(--padding-x) + 17px);
    }

    .neural-activity {
      width: calc(var(--bb-grid-size) * 4);
      height: calc(var(--bb-grid-size) * 4);
      border-radius: 50%;
      display: inline-block;
      margin-left: -2px;
      margin-top: -2px;
      margin-right: calc(var(--bb-grid-size) * 2);
      position: relative;
      z-index: 1;
      --background: #ffcc33;
    }

    .neural-activity:last-of-type {
      margin-right: 0;
    }

    .neural-activity.graphstart,
    .neural-activity.graphend,
    .activity-entry.graphstart::after,
    .activity-entry.graphend::after {
      --background: rgb(110, 84, 139);
    }

    .neural-activity.error,
    .activity-entry.error::after {
      --background: #cc0000;
    }

    .neural-activity.result,
    .activity-entry.result::after {
      --background: #ffa500;
    }

    .neural-activity.input,
    .activity-entry.input::after {
      --background: #c9daf8ff;
    }

    .neural-activity.secret,
    .activity-entry.secret::after {
      --background: #f4cccc;
    }

    .neural-activity.output,
    .activity-entry.output::after {
      --background: #b6d7a8ff;
    }

    .neural-activity,
    .activity-entry::after {
      background: radial-gradient(
        var(--background) 0%,
        var(--background) 50%,
        transparent 50%
      );
    }

    .neural-activity.pending,
    .activity-entry.pending::after {
      box-shadow: 0 0 0 4px #3399ff40;
      box-sizing: border-box;
      background: radial-gradient(
          var(--background) 0%,
          var(--background) 50%,
          transparent 50%
        ),
        linear-gradient(#3399ff40, #3399ffff);
      animation: rotate 1s linear infinite forwards;
    }

    .activity-entry:first-of-type::before {
      top: var(--top);
      height: calc(100% - var(--top));
    }

    .activity-entry:last-of-type::before {
      height: var(--top);
    }

    .activity-entry:first-of-type:last-of-type::before {
      display: none;
    }

    .activity-entry > .content {
      padding-left: calc(var(--bb-grid-size) * 6);
    }

    :host > .activity-entry > .content {
      padding-left: calc(var(--bb-grid-size) * 10);
    }

    .subgraph-info {
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
    }

    .subgraph-info summary {
      margin-left: -20px;
      display: grid;
      grid-template-columns: 20px auto;
      align-items: center;
    }

    .subgraph-info summary::before {
      content: "";
      width: 12px;
      height: 12px;
      background: var(--bb-expand-arrow) 1px -2px no-repeat;
      display: inline-block;
    }

    .subgraph-info[open] > summary::before {
      background: var(--bb-collapse-arrow) 1px 2px no-repeat;
    }

    .subgraph-info[open] > summary {
      margin-bottom: -20px;
    }

    .activity-summary {
      width: fit-content;
      position: relative;
    }

    .activity-summary::before {
      content: "";
      position: absolute;
      background: #ededed;
      border-radius: 8px;
      bottom: 6px;
      right: 2px;
      left: 1px;
      top: 1px;
      z-index: 0;
    }

    .subgraph-info[open] > summary .activity-summary {
      position: absolute;
      pointer-events: none;
      opacity: 0;
    }

    section h1[data-message-idx] {
      cursor: pointer;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary {
      list-style: none;
    }

    .node-output details {
      padding: calc(var(--bb-grid-size) * 2);
    }

    .node-output summary {
      font-size: var(--bb-text-small);
      margin: calc(var(--bb-grid-size) * 2) 0;
      font-weight: normal;
    }

    .node-output details div {
      font-size: var(--bb-text-nano);
      font-family: var(--bb-font-family-mono);
      line-height: 1.65;
    }

    .node-output img {
      border-radius: var(--bb-grid-size);
      display: block;
      width: 100%;
      border: 1px solid rgb(209, 209, 209);
    }

    dl {
      margin: 0;
      padding: 0;
    }

    dd {
      display: block;
      margin: calc(var(--bb-grid-size) * 2) 0 var(--bb-grid-size) 0;
      font-size: var(--bb-text-small);
    }

    dt {
      font-size: var(--bb-text-medium);
    }

    dt .value {
      border-radius: var(--bb-grid-size);
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
    }

    dt .value.input {
      border: 1px solid rgb(209, 209, 209);
      white-space: pre;
    }

    pre {
      display: inline-block;
      margin: 0;
    }

    #click-run {
      font-size: var(--bb-text-small);
      color: #9c9c9c;
      padding: 0 var(--padding-x) var(--padding-y) var(--padding-x);
    }

    .user-required {
      position: relative;
    }

    .user-required::before {
      content: "";
      position: absolute;
      left: -20px;
      top: -10px;
      right: -10px;
      bottom: -10px;
      background: var(--bb-selected-color);
      border-radius: var(--bb-grid-size);
      animation: fadeOut 1s ease-out forwards;
    }

    @keyframes rotate {
      from {
        transform: rotate(0);
      }

      to {
        transform: rotate(360deg);
      }
    }

    @keyframes fadeOut {
      0% {
        opacity: 0;
      }

      25% {
        opacity: 0.15;
      }

      50% {
        opacity: 0;
      }

      75% {
        opacity: 0.15;
      }

      100% {
        opacity: 0;
      }
    }
  `;

  #isImageURL(nodeValue: unknown): nodeValue is { image_url: string } {
    if (typeof nodeValue !== "object" || !nodeValue) {
      return false;
    }

    return "image_url" in nodeValue;
  }

  #isImageData(
    nodeValue: unknown
  ): nodeValue is { inline_data: { data: string; mime_type: string } } {
    if (typeof nodeValue !== "object" || !nodeValue) {
      return false;
    }

    return "inline_data" in nodeValue;
  }

  protected updated(): void {
    if (!this.#newestEntry.value) {
      return;
    }

    if (this.#newestEntry.value.querySelector(".user-required")) {
      this.dispatchEvent(new InputRequestedEvent());
    }

    this.#newestEntry.value.scrollIntoView(true);
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#observer.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#observer.disconnect();
  }

  #createRunInfo(runs: InspectableRun[] = []): HTMLTemplateResult {
    return html`${map(runs, (run) => {
      return html`<details class="subgraph-info">
        <summary>
          <span class="activity-summary"
            >${run.events.map((event, idx) => {
              if (event.type !== "node") {
                return nothing;
              }

              const classes: Record<string, boolean> = {
                "neural-activity": true,
                pending: idx === run.events.length - 1 && run.end === null,
                [event.node.type]: true,
              };

              return html`<div class=${classMap(classes)}></div>`;
            })}</span
          >
        </summary>
        ${map(run.events, (event, idx) => {
          if (event.type !== "node") {
            return nothing;
          }

          const classes: Record<string, boolean> = {
            "activity-entry": true,
            pending: idx === run.events.length - 1 && run.end === null,
            [event.node.type]: true,
          };

          return html`<div class=${classMap(classes)}>
            <div class="content">
              <h1>
                ${event.node.metadata?.description ??
                event.node.metadata?.title ??
                event.node.id ??
                event.node.type}
              </h1>
              ${this.#createRunInfo(event.runs)}
            </div>
          </div>`;
        })}
      </details>`;
    })}`;
  }

  render() {
    return html`
      <h1>${this.logTitle}</h1>
      ${this.events && this.events.length
        ? this.events.map((event, idx) => {
            let content: HTMLTemplateResult | symbol = nothing;
            switch (event.type) {
              case "node": {
                const { node, end, inputs, outputs } = event;
                // `end` is null if the node is still running
                // that is, the `nodeend` for this node hasn't yet
                // been received.
                if (end === null) {
                  if (node.type === "input") {
                    content = html`<section
                      class=${classMap({ "user-required": this.#isHidden })}
                    >
                      <h1
                        ?data-message-idx=${this.showExtendedInfo
                          ? idx
                          : nothing}
                      >
                        ${node.metadata?.title ?? node.id ?? node.type}
                      </h1>
                      <bb-input
                        id="${node.id}"
                        .secret=${false}
                        .remember=${false}
                        .configuration=${event.inputs}
                      ></bb-input>
                    </section>`;
                    break;
                  }

                  content = html`
                    <h1>${node.metadata?.title ?? node.id ?? node.type}</h1>
                    ${this.#createRunInfo(event.runs)}
                  `;
                } else {
                  // This is fiddly. Output nodes don't have any outputs.
                  let additionalData: HTMLTemplateResult | symbol = nothing;
                  if (node.type === "input" || node.type === "output") {
                    const result = node.type === "output" ? inputs : outputs;
                    additionalData = html`<dl class="node-output">
                      ${result
                        ? Object.entries(result).map(([key, nodeValue]) => {
                            let title = key;
                            if (node.configuration?.schema) {
                              const schema = node.configuration
                                .schema as Schema;
                              if (schema.properties && schema.properties[key]) {
                                title = schema.properties[key].title ?? key;
                              }
                            }

                            let value: HTMLTemplateResult | symbol = nothing;
                            if (typeof nodeValue === "object") {
                              if (this.#isImageData(nodeValue)) {
                                value = html`<img
                                  src="data:image/${nodeValue.inline_data
                                    .mime_type};base64,${nodeValue.inline_data
                                    .data}"
                                />`;
                              } else if (this.#isImageURL(nodeValue)) {
                                value = html`<img
                                  src=${nodeValue.image_url}
                                />`;
                              } else {
                                value = html`<bb-json-tree
                                  .json=${nodeValue}
                                ></bb-json-tree>`;
                              }
                            } else {
                              // prettier-ignore
                              value = html`<div
                                class=${classMap({
                                  value: true,
                                  [node.type]: true,
                                })}
                              >${nodeValue}
                              </div>`;
                            }

                            return html`<dd>${title}</dd>
                              <dt>${value}</dt>`;
                          })
                        : html`No data provided`}
                    </dl>`;
                  }

                  content = html`<section>
                    <h1
                      ?data-message-idx=${this.showExtendedInfo ? idx : nothing}
                    >
                      ${node.metadata?.title ?? node.id ?? node.type}
                    </h1>
                    ${additionalData} ${this.#createRunInfo(event.runs)}
                  </section>`;
                  break;
                }
                break;
              }

              case "secret": {
                if (event.end !== null) {
                  return nothing;
                }

                content = html`<section
                  class=${classMap({ "user-required": this.#isHidden })}
                >
                  <h1 data-message-idx=${idx}>${event.type}</h1>
                  ${event.keys.map((id) => {
                    const configuration = {
                      schema: {
                        properties: {
                          secret: {
                            title: id,
                            description: `Enter ${id}`,
                            type: "string",
                          },
                        },
                      },
                    };

                    return html`<bb-input
                      id="${id}"
                      .secret=${true}
                      .remember=${true}
                      .configuration=${configuration}
                    ></bb-input>`;
                  })}
                </section>`;
                break;
              }

              case "error": {
                const { error } = event;
                let output = "";
                if (typeof error === "string") {
                  output = error;
                } else {
                  let messageOutput = "";
                  let errorData = error;
                  while (typeof errorData === "object") {
                    if (errorData && "message" in errorData) {
                      messageOutput += `${errorData.message}\n`;
                    }

                    errorData = errorData.error as ErrorObject;
                  }

                  output = messageOutput;
                }

                content = html`${output}`;
                break;
              }

              default: {
                return nothing;
              }
            }

            const classes: Record<string, boolean> = {
              "activity-entry": true,
              [event.type]: true,
            };

            if (event.type === "node") {
              classes[event.node.type] = true;
            }

            const styles: Record<string, string> = {};
            if (
              event.type === "node" &&
              event.node.metadata &&
              event.node.metadata.visual &&
              typeof event.node.metadata.visual === "object"
            ) {
              const visual = event.node.metadata.visual as Record<
                string,
                string
              >;
              classes.icon = true;
              styles["--node-icon"] = `url(${visual.icon})`;
            }

            return html`<div
              ${ref(this.#newestEntry)}
              style="${styleMap(styles)}"
              class="${classMap(classes)}"
            >
              <div class="content">${content}</div>
            </div>`;
          })
        : html`<div id="click-run">Click "Run" to get started</div>`}
    `;
  }
}
