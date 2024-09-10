/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  isLLMContent,
  isLLMContentArray,
  type ErrorObject,
  type Schema,
} from "@google-labs/breadboard";
import {
  LitElement,
  html,
  css,
  nothing,
  type HTMLTemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { until } from "lit/directives/until.js";
import { type Ref, createRef, ref } from "lit/directives/ref.js";
import {
  type UserInputConfiguration,
  type UserMessage,
} from "../../types/types.js";
import { InputEnterEvent } from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";
import {
  isImageURL,
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../utils/content-schema.js";

import * as BreadboardUI from "@breadboard-ai/shared-ui";

@customElement("bb-activity-log-lite-app")
export class ActivityLogLite extends LitElement {
  @property()
  start: number = 0;

  @property()
  message: UserMessage | null = null;

  @property()
  log: BreadboardUI.Types.LogEntry[] = [];

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      padding-bottom: 60px;
    }

    #controls {
      position: sticky;
      top: 0;
      background: var(--bb-neutral-0);
      display: grid;
      grid-template-rows: 24px;
      row-gap: var(--bb-grid-size-10);
      align-items: center;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-2);
      z-index: 1;
    }

    #controls input {
      border-radius: var(--bb-grid-size);
      border: 1px solid var(--bb-neutral-300);
      background: var(--bb-neutral-50);
      width: 100%;
      padding: var(--bb-grid-size-2);
      height: 100%;
    }

    #controls input:placeholder-shown {
      background: var(--bb-neutral-50) var(--bb-icon-search) calc(100% - 5px)
        center / 20px 20px no-repeat;
    }

    #activity {
      padding: var(--bb-grid-size-2);
    }

    #actions {
      display: flex;
      justify-content: flex-end;
    }

    #actions button {
      border: none;
      margin: 0 0 0 var(--bb-grid-size-8);
      padding: 0 var(--bb-grid-size-8) 0 0;
      height: 20px;
      font: var(--bb-font-label-medium);
      color: var(--bb-neutral-600);
      transition: color 0.3s cubic-bezier(0, 0, 0.3, 1);
      cursor: pointer;
    }

    #actions button:focus,
    #actions button:hover {
      color: var(--bb-neutral-800);
      transition-duration: 0.15s;
    }

    #jump-to-bottom {
      background: transparent var(--bb-icon-arrow-down-48px) right center / 24px
        24px no-repeat;
    }

    #actions button:last-of-type {
      margin-right: var(--bb-grid-size);
    }

    #no-entries {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--bb-grid-size-10) 0;
      font: var(--bb-font-title-large);
      color: var(--bb-neutral-400);
    }

    .node-output {
      margin: 0;
    }

    .pending-input,
    .edge {
      padding: var(--bb-grid-size-4) var(--bb-grid-size-2) var(--bb-grid-size-4)
        var(--bb-grid-size-16);
      position: relative;
    }

    .pending-input.newest,
    .edge.newest {
      animation: fadeAndSlideIn 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
    }

    .edge.newest {
      margin-bottom: var(--bb-grid-size-16);
    }

    .edge.empty {
      height: 0;
      display: flex;
      align-items: center;
      color: var(--bb-neutral-600);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      padding-top: var(--bb-grid-size-2);
      padding-bottom: var(--bb-grid-size-2);
    }

    .pending-input::before,
    .edge::before {
      content: "";
      position: absolute;
      top: 0;
      left: 40px;
      height: 100%;
      border-left: 1px solid var(--bb-neutral-300);
    }

    .pending-input::after,
    .edge::after {
      content: "";
      position: absolute;
      top: calc(50% - 14px);
      left: 26px;
      width: 28px;
      height: 28px;
      border: 1px solid var(--bb-neutral-300);
      border-radius: 50%;
    }

    .pending-input.newest::before,
    .edge.newest::before {
      transform: scaleY(0);
      animation: growFromTop 0.3s cubic-bezier(0, 0, 0.3, 1) 0.2s forwards;
    }

    .pending-input.newest::after,
    .edge.newest::after {
      opacity: 0;
      animation: fadeAndSlideIn 0.3s cubic-bezier(0, 0, 0.3, 1) 0.4s forwards;
    }

    .pending-input::after {
      background: var(--bb-neutral-0) var(--bb-icon-input) center center / 20px
        20px no-repeat;
    }

    .edge::after {
      background: var(--bb-neutral-0) var(--bb-icon-output) center center / 20px
        20px no-repeat;
    }

    .edge.empty::after {
      display: none;
    }

    .edge.empty.newest::before {
      display: none;
    }

    .edge bb-llm-output,
    .edge bb-llm-output-array {
      margin-bottom: 0;
    }

    .pending-input:last-of-type::before,
    .edge:last-of-type::before {
      height: 50%;
    }

    .entry {
      position: relative;
      border: 1px solid var(--bb-neutral-200);
      border-radius: var(--bb-grid-size-10);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      width: 50%;
      animation: fadeAndSlideIn 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
    }

    .entry.pending::after {
      content: "";
      position: absolute;
      left: calc(100% + var(--bb-grid-size-2));
      top: calc(50% - 8px);
      width: 16px;
      height: 16px;
      background: url(/images/progress-ui.svg) center center / 16px 16px
        no-repeat;
    }

    .entry:not(.pending)::after {
      content: attr(completed);
      position: absolute;
      left: calc(100% + var(--bb-grid-size-2));
      top: calc(50% - 8px);
      height: 16px;
      color: var(--bb-neutral-600);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      width: auto;
      min-width: 150px;
    }

    .entry.hidden {
      display: none;
    }

    .entry {
      display: flex;
      align-items: flex-start;
      list-style: none;
      font: var(--bb-font-title-small);
      color: var(--bb-neutral-600);
      user-select: none;
    }

    .entry::before {
      content: "";
      width: 20px;
      height: 20px;
      background: var(--bb-ui-50) var(--bb-icon-generic-node) center center /
        20px 20px no-repeat;
      border-radius: 50%;
      margin-right: var(--bb-grid-size-2);
    }

    .entry.input::before {
      background: var(--bb-icon-input) center center / 20px 20px no-repeat;
    }

    .entry.output::before {
      background: var(--bb-icon-output) center center / 20px 20px no-repeat;
    }

    .entry.secret::before {
      background: var(--bb-icon-password) center center / 20px 20px no-repeat;
    }

    .entry.specialist {
      color: var(--bb-ui-500);
    }

    .entry.specialist::before {
      background: var(--bb-icon-smart-toy) center center / 20px 20px no-repeat;
    }

    .entry.human,
    .entry.user {
      color: var(--bb-human-500);
    }

    .entry.human::before,
    .entry.user::before {
      background: var(--bb-icon-human) center center / 20px 20px no-repeat;
    }

    .entry.looper {
      color: var(--bb-looper-500);
    }

    .entry.looper::before {
      background: var(--bb-icon-lightbulb) center center / 20px 20px no-repeat;
    }

    .entry.joiner {
      color: var(--bb-looper-500);
    }

    .entry.joiner::before {
      background: var(--bb-icon-merge-type) center center / 20px 20px no-repeat;
    }

    .entry.runjavascript {
      color: var(--bb-nodes-700);
    }

    .entry.runjavascript::before {
      background: var(--bb-nodes-400) var(--bb-icon-javascript) center center /
        20px 20px no-repeat;
    }

    .entry .no-information {
      font: var(--bb-font-label-medium);
      color: var(--bb-neutral-600);
      width: 100%;
      text-align: center;
      margin-top: var(--bb-grid-size);
    }

    .continue-button {
      background: var(--bb-ui-100) var(--bb-icon-resume-blue) 8px 4px / 16px
        16px no-repeat;
      color: var(--bb-ui-700);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
      margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
    }

    .completed-item .title {
      display: block;
      font: 600 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
    }

    .completed-item .description {
      display: block;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin: 0 0 var(--bb-grid-size-2) 0;
      max-width: 90%;
    }

    .error {
      display: flex;
      background: var(--bb-warning-50);
      border: 2px solid var(--bb-warning-100);
      padding: var(--bb-grid-size-3);
      border-radius: var(--bb-grid-size-2);
      color: var(--bb-warning-700);
      overflow: auto;
      font: var(--bb-font-body-small);
      font-family: var(--bb-font-family-mono);
    }

    @media (min-width: 700px) {
      #controls {
        grid-template-rows: 24px;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-2)
          var(--bb-grid-size-3) 0;
      }

      #activity {
        padding: var(--bb-grid-size-2) var(--bb-grid-size-2)
          var(--bb-grid-size-2) 0;
      }
    }

    @media (min-width: 1120px) {
      #controls {
        grid-template-rows: 24px;
        padding: var(--bb-grid-size-3) 0;
      }

      #controls input {
        height: 42px;
      }

      #activity {
        padding: var(--bb-grid-size-2) 0;
      }
    }

    @keyframes fadeAndSlideIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }

    @keyframes growFromTop {
      from {
        transform-origin: 0 0;
        transform: scale(1, 0);
      }

      to {
        transform-origin: 0 0;
        transform: scale(1, 1);
      }
    }
  `;

  #jumpToBottomAfterUpdated = false;
  #formatter = new Intl.DateTimeFormat(navigator.languages, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  #userInputRef: Ref<BreadboardUI.Elements.UserInput> = createRef();
  #activityRef: Ref<HTMLDivElement> = createRef();

  async #renderPendingInput(event: BreadboardUI.Types.EdgeLogEntry) {
    const schema = event.schema as Schema;
    if (!schema) {
      return html`Unable to render`;
    }

    const requiredFields = schema.required ?? [];

    // TODO: Implement support for multiple iterations over the
    // same input over a run. Currently, we will only grab the
    // first value.
    const userInputs: UserInputConfiguration[] = Object.entries(
      schema.properties ?? {}
    ).reduce((prev, [name, schema]) => {
      let value = undefined;
      if (schema.type === "object") {
        if (isLLMContentBehavior(schema)) {
          if (!isLLMContent(value)) {
            value = undefined;
          }
        } else {
          value = JSON.stringify(value, null, 2);
        }
      }

      if (schema.type === "array") {
        if (isLLMContentArrayBehavior(schema)) {
          if (!isLLMContentArray(value)) {
            value = undefined;
          }
        } else {
          value = JSON.stringify(value, null, 2);
        }
      }

      prev.push({
        name,
        title: schema.title ?? name,
        secret: false,
        schema,
        configured: false,
        required: requiredFields.includes(name),
        value,
      });

      return prev;
    }, [] as UserInputConfiguration[]);

    const continueRun = () => {
      if (!this.#userInputRef.value) {
        return;
      }

      const outputs = this.#userInputRef.value.processData(true);
      if (!outputs) {
        return;
      }

      this.dispatchEvent(
        new InputEnterEvent(event.id!, outputs, /* allowSavingIfSecret */ true)
      );
    };

    return html`<bb-user-input
        id="${event.id}"
        .inputs=${userInputs}
        .inlineControls=${true}
        .llmInputShowEntrySelector=${false}
        ${ref(this.#userInputRef)}
        @keydown=${(evt: KeyboardEvent) => {
          const isMac = navigator.platform.indexOf("Mac") === 0;
          const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

          if (!(evt.key === "Enter" && isCtrlCommand)) {
            return;
          }

          continueRun();
        }}
      ></bb-user-input>
      <button class="continue-button" @click=${() => continueRun()}>
        Continue
      </button>`;
  }

  async #renderCompletedInputOrOutput(event: BreadboardUI.Types.EdgeLogEntry) {
    const { value, schema } = event;
    const type = event.id ? "input" : "output";
    if (!value) {
      return html`Unable to render item`;
    }

    const properties = schema?.properties ?? {};

    return html`<dl class="node-output">
      ${Object.entries(value).map(([name, nodeValue]) => {
        let value: HTMLTemplateResult | symbol = nothing;
        if (typeof nodeValue === "object") {
          if (isLLMContentArray(nodeValue)) {
            value = html`<bb-llm-output-array
              .values=${nodeValue}
              .showEntrySelector=${false}
              .showModeToggle=${false}
              .clamped=${false}
              .lite=${true}
            ></bb-llm-output-array>`;
          } else if (isLLMContent(nodeValue)) {
            if (!nodeValue.parts) {
              // Special case for "$metadata" item.
              // See https://github.com/breadboard-ai/breadboard/issues/1673
              // TODO: Make this not ugly.
              const data = (nodeValue as unknown as { data: unknown }).data;
              value = html`<bb-json-tree .json=${data}></bb-json-tree>`;
            }

            if (!nodeValue.parts.length) {
              value = html`No data provided`;
            }

            value = nodeValue.parts.length
              ? html`<bb-llm-output
                  .clamped=${false}
                  .lite=${true}
                  .value=${nodeValue}
                ></bb-llm-output>`
              : html`No data provided`;
          } else if (isImageURL(nodeValue)) {
            value = html`<img src=${nodeValue.image_url} />`;
          } else {
            value = html`<bb-json-tree .json=${nodeValue}></bb-json-tree>`;
          }
        } else {
          let renderableValue: HTMLTemplateResult | symbol = nothing;
          const format = properties[name]?.format;
          if (
            format &&
            format === "markdown" &&
            typeof nodeValue === "string"
          ) {
            renderableValue = html`${BreadboardUI.Directives.markdown(
              nodeValue
            )}`;
          } else {
            renderableValue = html`${nodeValue !== undefined
              ? nodeValue
              : "No value provided"}`;
          }

          // prettier-ignore
          value = html`<div
            class=${classMap({
              markdown: format === 'markdown',
              value: true,
              [type]: true,
            })}
          >${renderableValue}</div>`;
        }

        let title: HTMLTemplateResult | symbol = nothing;
        let description: HTMLTemplateResult | symbol = nothing;
        if (schema && schema.properties) {
          title = html`${schema.properties[name]?.title ?? `Input`}`;

          if (schema.properties[name]?.description) {
            description = html`<span class="description"
              >${schema.properties[name]?.description}</span
            >`;
          }
        }

        return type === "input"
          ? html`<div class="completed-item">
              <label>
                <span class="title">${title}</span>
                ${description}
              </label>
              ${value}
            </div>`
          : html`${value}`;
      })}
    </dl>`;
  }

  #renderLog(entries: BreadboardUI.Types.LogEntry[]) {
    return html`${map(entries, (entry, idx) => {
      const newest = idx === entries.length - 1;
      switch (entry.type) {
        case "edge": {
          const pending = entry.end === null;

          if (entry.id) {
            // The "input" edge will have an id
            // TODO: Maybe we should just have different types of edges?
            if (entry.end !== null) {
              return html`<section
                class=${classMap({
                  ["edge"]: true,
                  newest,
                  pending,
                })}
              >
                ${until(this.#renderCompletedInputOrOutput(entry))}
              </section>`;
            }
            return html`<section
              class=${classMap({
                ["pending-input"]: true,
                newest,
                pending,
              })}
            >
              ${until(this.#renderPendingInput(entry))}
            </section>`;
          }

          if (entry.value) {
            // The "output" edge will have no id, but will have a value.
            return html`<section
              class=${classMap({
                ["edge"]: true,
                newest,
                pending,
              })}
            >
              ${until(this.#renderCompletedInputOrOutput(entry))}
            </section>`;
          }

          return html`<section
            class=${classMap({
              ["edge"]: true,
              ["empty"]: true,
              newest,
              pending,
            })}
          ></section>`;
        }

        case "node": {
          const { descriptor, end } = entry;
          const { type } = descriptor;
          const icon = undefined;

          let content:
            | HTMLTemplateResult
            | Promise<HTMLTemplateResult>
            | symbol = nothing;

          const classes: Record<string, boolean> = {
            entry: true,
            pending: end === null,
          };

          classes[type.toLocaleLowerCase()] = true;
          classes.pending = end === null;
          if (icon) {
            classes[icon] = true;
          }

          let completed = null;
          if (end !== null) {
            completed = this.#formatter.format(this.start + end);
          }

          return html` <section
              class=${classMap(classes)}
              completed=${completed ?? nothing}
            >
              ${entry.title()}
            </section>
            ${content}`;
        }

        case "error": {
          const { error } = entry;
          let output = "";
          if (typeof error === "string") {
            output = error;
          } else {
            if ((error.error as Error)?.name === "AbortError") {
              console.log("💖 actually aborted");
            }
            if (typeof error.error === "string") {
              output = error.error;
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
          }

          return html`<section class="error">${output}</section>`;
        }
      }
    })}`;
  }

  #jumpToBottom() {
    if (!this.#activityRef.value) {
      return;
    }

    const entries =
      this.#activityRef.value.querySelectorAll<HTMLElement>(".entry");
    if (entries.length === 0) {
      return;
    }

    const entry = entries[entries.length - 1];
    if (!entry) {
      return;
    }
    entry.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (!changedProperties.has("log")) {
      return;
    }

    this.#jumpToBottomAfterUpdated = true;
  }

  protected updated(): void {
    if (!this.#jumpToBottomAfterUpdated) {
      return;
    }

    this.#jumpToBottomAfterUpdated = false;
    requestAnimationFrame(() => {
      this.#jumpToBottom();
    });
  }

  render() {
    return html` <div id="controls">
        <div id="actions">
          ${this.log.length
            ? html`<button
                @click=${() => this.#jumpToBottom()}
                id="jump-to-bottom"
              >
                Jump to bottom
              </button>`
            : nothing}
        </div>
      </div>
      <div id="activity" ${ref(this.#activityRef)}>
        ${this.log.length
          ? this.#renderLog(this.log)
          : html`<div id="no-entries">
              <picture>
                <source srcset="${this.message?.srcset}" type="image/webp" />
                <img
                  src="${this.message?.src}"
                  alt="${this.message?.alt}"
                  width="128"
                  height="128"
                />
              </picture>
              <p>No activity information</p>
            </div>`}
      </div>`;
  }
}
