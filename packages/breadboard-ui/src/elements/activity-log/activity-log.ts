/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ErrorObject,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunNodeEvent,
  OutputValues,
} from "@google-labs/breadboard";
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { InputRequestedEvent } from "../../events/events.js";
import { map } from "lit/directives/map.js";
import { styleMap } from "lit/directives/style-map.js";
import { until } from "lit/directives/until.js";
import { markdown } from "../../directives/markdown.js";
import { SETTINGS_TYPE, Settings } from "../../types/types.js";

@customElement("bb-activity-log")
export class ActivityLog extends LitElement {
  @property({ reflect: false })
  run: InspectableRun | null = null;

  @property({ reflect: false })
  events: InspectableRunEvent[] | null = null;

  @property({ reflect: true })
  eventPosition = 0;

  @property({ reflect: true })
  logTitle = "Activity Log";

  @property({ reflect: true })
  showExtendedInfo = false;

  @property()
  settings: Settings | null = null;

  #seenItems = new Set<string>();
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
      display: flex;
    }

    :host > h1 > span {
      flex: 1;
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

    :host > h1 > a {
      font-size: var(--bb-label-small);
      color: var(--bb-neutral-500);
      text-decoration: none;
      user-select: none;
      cursor: pointer;
    }

    :host > h1 > a:hover,
    :host > h1 > a:active {
      color: var(--bb-neutral-700);
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
      font-size: var(--bb-text-regular);
      margin: 0;
      font-weight: 400;
    }

    .activity-entry h1 .newest-task {
      font-size: var(--bb-text-medium);
      font-weight: 300;
      margin-left: var(--bb-grid-size);
    }

    .activity-entry::after {
      content: "";
      width: calc(var(--bb-grid-size) * 4);
      height: calc(var(--bb-grid-size) * 4);
      border-radius: 50%;
      top: calc(var(--padding-y) + var(--bb-grid-size) - 3px);
      left: -2px;
      position: absolute;
      --background: var(--bb-nodes-400);
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
      background: var(--bb-neutral-300);
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
      --background: var(--bb-nodes-400);
    }

    .neural-activity:last-of-type {
      margin-right: 0;
    }

    .neural-activity.error,
    .activity-entry.error::after {
      --background: #cc0000;
    }

    .neural-activity.input,
    .activity-entry.input::after {
      --background: var(--bb-inputs-300);
    }

    .neural-activity.secret,
    .activity-entry.secret::after {
      --background: var(--bb-inputs-300);
    }

    .neural-activity.output,
    .activity-entry.output::after {
      --background: var(--bb-output-300);
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

    h1[data-message-id] {
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
      border: 1px solid var(--bb-neutral-300);
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
      white-space: pre-line;
      border-radius: var(--bb-grid-size);
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
    }

    dt .value.markdown {
      white-space: normal;
      line-height: 1.5;
      user-select: text;
    }

    dt .value.output * {
      margin: var(--bb-grid-size) 0;
    }

    dt .value.output h1 {
      font-size: var(--bb-title-large);
      margin: calc(var(--bb-grid-size) * 4) 0 calc(var(--bb-grid-size) * 1) 0;
    }

    dt .value.output h2 {
      font-size: var(--bb-title-medium);
      margin: calc(var(--bb-grid-size) * 4) 0 calc(var(--bb-grid-size) * 1) 0;
    }

    dt .value.output h3,
    dt .value.output h4,
    dt .value.output h5 {
      font-size: var(--bb-title-small);
      margin: 0 0 calc(var(--bb-grid-size) * 2) 0;
    }

    dt .value.output p {
      font-size: var(--bb-body-medium);
      margin: 0 0 calc(var(--bb-grid-size) * 2) 0;
    }

    dt .value.input {
      border: 1px solid var(--bb-neutral-300);
      white-space: pre-line;
      max-height: 300px;
      overflow-y: auto;
      scrollbar-gutter: stable;
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

    @keyframes slideIn {
      from {
        translate: 0 -5px;
        opacity: 0;
      }

      to {
        translate: 0 0;
        opacity: 1;
      }
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

  #createRunInfo(runs: InspectableRun[] = []): HTMLTemplateResult | symbol {
    if (runs.length === 0) {
      return nothing;
    }

    return html`${map(runs, (run) => {
      if (run.events.length === 0) {
        return nothing;
      }

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
                [event.node.descriptor.type]: true,
              };

              return html`<div class=${classMap(classes)}></div>`;
            })}</span
          >
        </summary>
        ${map(run.events, (event, idx) => {
          if (event.type !== "node") {
            return nothing;
          }

          const { type } = event.node.descriptor;

          const classes: Record<string, boolean> = {
            "activity-entry": true,
            pending: idx === run.events.length - 1 && run.end === null,
            [type]: true,
          };

          return html`<div class=${classMap(classes)}>
            <div class="content">
              <h1 data-message-id=${this.showExtendedInfo ? event.id : nothing}>
                ${event.node.description()}
              </h1>
              ${this.#createRunInfo(event.runs)}
            </div>
          </div>`;
        })}
      </details>`;
    })}`;
  }

  #getNewestSubtask(runs: InspectableRun[] = []): HTMLTemplateResult | symbol {
    if (runs.length === 0) {
      return nothing;
    }

    const newestRun = runs[runs.length - 1];
    const newestEvent = newestRun.events[newestRun.events.length - 1];

    if (!newestEvent || newestEvent.type !== "node") {
      return nothing;
    }

    return html`<span class="newest-task"
      >${newestEvent.node.description()}</span
    >`;
  }

  #getRunLog(evt: Event) {
    if (!(evt.target instanceof HTMLAnchorElement)) {
      return;
    }

    if (!this.run || !this.run.serialize) {
      return;
    }

    if (evt.target.href) {
      URL.revokeObjectURL(evt.target.href);
    }

    const data = JSON.stringify(this.run.serialize(), null, 2);

    evt.target.download = `run-${new Date().toISOString()}.json`;
    evt.target.href = URL.createObjectURL(
      new Blob([data], { type: "application/json" })
    );
  }

  async #renderPendingInput(idx: number, event: InspectableRunNodeEvent) {
    const { inputs, node } = event;
    const nodeSchema = await node.describe(inputs);
    const descriptor = node.descriptor;
    const schema = nodeSchema?.outputSchema || inputs.schema;
    return html`<section class=${classMap({ "user-required": this.#isHidden })}>
      <h1 ?data-message-idx=${this.showExtendedInfo ? idx : nothing}>
        ${node.title()}
      </h1>
      <bb-input
        id="${descriptor.id}"
        .secret=${false}
        .remember=${false}
        .schema=${schema}
      ></bb-input>
    </section>`;
  }

  async #renderDoneInputOrOutput(event: InspectableRunNodeEvent) {
    const { node, inputs, outputs } = event;
    const allPorts = await node.ports(inputs, outputs as OutputValues);
    const type = node.descriptor.type;
    const isOutput = type === "output";
    const portList = isOutput ? allPorts.inputs : allPorts.outputs;
    return html`<dl class="node-output">
      ${portList.ports.map((port) => {
        if (port.star) return nothing;
        if (isOutput && port.name === "schema") return nothing;
        const nodeValue = port.value;
        let value: HTMLTemplateResult | symbol = nothing;
        if (typeof nodeValue === "object") {
          if (this.#isImageData(nodeValue)) {
            value = html`<img
              src="data:image/${nodeValue.inline_data
                .mime_type};base64,${nodeValue.inline_data.data}"
            />`;
          } else if (this.#isImageURL(nodeValue)) {
            value = html`<img src=${nodeValue.image_url} />`;
          } else {
            value = html`<bb-json-tree .json=${nodeValue}></bb-json-tree>`;
          }
        } else {
          let renderableValue: HTMLTemplateResult | symbol = nothing;
          if (
            port.schema.format === "markdown" &&
            typeof nodeValue === "string"
          ) {
            renderableValue = html`${markdown(nodeValue)}`;
          } else {
            renderableValue = html`${nodeValue}`;
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

        return html`<dd>${port.title}</dd>
          <dt>${value}</dt>`;
      })}
    </dl>`;
  }

  render() {
    if (!this.events || this.#seenItems.size > this.events.length) {
      this.#seenItems.clear();
    }
    const showLogDownload = this.run && this.run.serialize;

    return html`
      <h1>
        <span>${this.logTitle}</span>${showLogDownload
          ? html`<a @click=${(evt: Event) => this.#getRunLog(evt)}>Download</a>`
          : nothing}
      </h1>
      ${this.events && this.events.length
        ? this.events.map((event, idx) => {
            const isNew = this.#seenItems.has(event.id);
            this.#seenItems.add(event.id);

            let content:
              | HTMLTemplateResult
              | Promise<HTMLTemplateResult>
              | symbol = nothing;
            switch (event.type) {
              case "node": {
                const { node, end } = event;
                const { type } = node.descriptor;
                // `end` is null if the node is still running
                // that is, the `nodeend` for this node hasn't yet
                // been received.
                if (end === null) {
                  if (type === "input") {
                    content = this.#renderPendingInput(idx, event);
                    break;
                  }

                  if (event.hidden) {
                    content = html`<h1>Working</h1>`;
                  } else {
                    content = html`
                      <h1>
                        ${node.title()} ${this.#getNewestSubtask(event.runs)}
                      </h1>
                      ${this.#createRunInfo(event.runs)}
                    `;
                  }
                } else {
                  let additionalData: Promise<HTMLTemplateResult> | symbol =
                    nothing;
                  if (type === "input" || type === "output") {
                    additionalData = this.#renderDoneInputOrOutput(event);
                  }

                  content = html`<section>
                    <h1
                      data-message-id=${this.showExtendedInfo
                        ? event.id
                        : nothing}
                    >
                      ${node.title()}
                    </h1>
                    ${until(additionalData)} ${this.#createRunInfo(event.runs)}
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

                    let values = null;
                    if (this.settings) {
                      const savedSecret =
                        this.settings[SETTINGS_TYPE.SECRETS].items.get(id) ||
                        null;

                      if (savedSecret) {
                        values = { secret: savedSecret.value };
                      }
                    }

                    return html`<bb-input
                      id="${id}"
                      .values=${values}
                      .secret=${true}
                      .remember=${true}
                      .schema=${configuration.schema}
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
              new: isNew,
              [event.type]: true,
            };

            if (event.type === "node") {
              classes[event.node.descriptor.type] = true;
            }

            const styles: Record<string, string> = {};
            if (
              event.type === "node" &&
              event.node.descriptor.metadata &&
              event.node.descriptor.metadata.visual &&
              typeof event.node.descriptor.metadata.visual === "object"
            ) {
              const visual = event.node.descriptor.metadata.visual as Record<
                string,
                string
              >;
              if (visual.icon) {
                classes.icon = true;
                styles["--node-icon"] = `url(${visual.icon})`;
              }
            }

            return html`<div
              ${ref(this.#newestEntry)}
              style="${styleMap(styles)}"
              class="${classMap(classes)}"
            >
              <div class="content">${until(content)}</div>
            </div>`;
          })
        : html`<div id="click-run">Click "Run" to get started</div>`}
    `;
  }
}
